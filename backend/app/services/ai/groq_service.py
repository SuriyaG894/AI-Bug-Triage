import os
from typing import Optional, Dict, Any, List
from groq import AsyncGroq
from app.core.config import settings

client = AsyncGroq(api_key=settings.groq_api_key_decrypted)


async def classify_bug(description: str) -> Dict[str, Any]:
    if not settings.groq_api_key_decrypted:
        return {"severity": "medium", "type": "general", "confidence": 0.5}

    prompt = f"""You are a bug triage expert. Analyze this bug description and classify it.

Bug Description: {description}

Analyze and respond ONLY with valid JSON like these examples:
{{"severity": "high", "type": "performance", "confidence": 0.85}}
{{"severity": "critical", "type": "backend", "confidence": 0.9}}
{{"severity": "medium", "type": "ui", "confidence": 0.75}}

Rules:
- severity: critical (>user cannot use app), high (>major feature broken), medium (>minor issue), low (>cosmetic)
- type: ui (user interface issues), backend (server/logic issues), api (REST/GraphQL issues), data (database queries), security (vulnerabilities), performance (speed/memory issues)
- confidence: 0.5-1.0 based on how clear the description is

Respond NOW with JSON only:"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=150,
        )
        
        content = response.choices[0].message.content
        import json
        
        # Try to extract JSON from response
        content = content.strip()
        if '{' in content and '}' in content:
            start = content.find('{')
            end = content.rfind('}') + 1
            result = json.loads(content[start:end])
            return {
                "severity": result.get("severity", "medium"),
                "type": result.get("type", "general"),
                "confidence": result.get("confidence", 0.7),
            }
        return {"severity": "medium", "type": "general", "confidence": 0.5}
    except Exception as e:
        return {"severity": "medium", "type": "general", "confidence": 0.5}


async def suggest_root_causes(description: str, classification: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not settings.groq_api_key_decrypted:
        return [
            {"cause": "Input validation missing", "confidence": 0.6},
            {"cause": "Race condition", "confidence": 0.4},
            {"cause": "Null pointer exception", "confidence": 0.3},
        ]

    bug_type = classification.get('type', 'general')
    prompt = f"""You are a debugging expert. Analyze this bug and find ROOT CAUSES.

Bug: {description}
Bug Type: {bug_type}

Think step by step:
1. What is the exact error/issue?
2. What code or configuration causes this?
3. Why does it happen?

Respond ONLY with JSON array format:
[{{"cause": "specific root cause 1", "confidence": 0.85}}, {{"cause": "specific root cause 2", "confidence": 0.7}}, {{"cause": "specific root cause 3", "confidence": 0.6}}]

Requirements:
- Each cause must be SPECIFIC to this bug, not generic
- Include confidence based on likelihood (0.5-0.95)
- Do NOT use generic causes like "input validation missing" or "null handling"
- Do NOT repeat similar causes

Response NOW with JSON only:"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=250,
        )
        
        content = response.choices[0].message.content
        import json
        
        # Extract JSON array
        content = content.strip()
        if '[' in content and ']' in content:
            start = content.find('[')
            end = content.rfind(']') + 1
            causes = json.loads(content[start:end])
            return causes if isinstance(causes, list) else []
        return [
            {"cause": "Unable to analyze", "confidence": 0.5},
        ]
    except Exception:
        return [
            {"cause": "Analysis failed", "confidence": 0.5},
        ]


async def generate_embedding(text: str) -> Optional[List[float]]:
    import hashlib
    
    hash_val = hashlib.sha256(text.encode()).hexdigest()
    
    values = []
    for i in range(0, min(64, len(hash_val)), 2):
        try:
            val = int(hash_val[i:i+2], 16)
        except ValueError:
            val = int(hash_val[i:i+1], 16) if hash_val[i:i+1].isalnum() else 0
        values.append(float(val) / 255.0)
    
    while len(values) < 1536:
        ext = hashlib.sha256((text + str(len(values))).encode()).hexdigest()
        for i in range(0, min(64, len(ext)), 2):
            try:
                val = int(ext[i:i+2], 16)
            except ValueError:
                val = 0
            values.append(float(val) / 255.0)
    
    return values[:1536]