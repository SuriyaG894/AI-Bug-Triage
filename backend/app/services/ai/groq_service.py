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


STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than", "too",
    "very", "just", "also", "then", "that", "this", "these", "those",
    "it", "its", "i", "me", "my", "we", "our", "you", "your", "he",
    "she", "they", "them", "their", "what", "which", "who", "whom",
    "when", "where", "why", "how", "if", "because", "while", "although",
    "about", "up", "out", "off", "over", "under", "again", "further",
    "once", "here", "there", "am", "s", "t", "don", "doesn", "didn",
    "won", "wouldn", "couldn", "shouldn", "isn", "aren", "wasn", "weren",
}


def extract_keywords(text: str) -> List[str]:
    """Extract meaningful keywords from text by removing stop words and short tokens."""
    import re
    # Normalize: lowercase, remove special characters
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    words = text.split()
    # Filter stop words and very short tokens
    keywords = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    return keywords


async def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate a semantically meaningful embedding for bug text.
    
    Uses Groq LLM to extract semantic keywords, then builds a deterministic
    embedding from those keywords. Falls back to local keyword extraction
    if Groq is unavailable.
    """
    import hashlib
    
    keywords = []
    
    # Try Groq-powered keyword extraction for better semantic understanding
    if settings.groq_api_key_decrypted:
        try:
            prompt = f"""Extract 5-10 unique technical keywords from this bug report that capture its core meaning.
Return ONLY a comma-separated list of lowercase keywords, nothing else.

Bug text: {text[:500]}

Keywords:"""
            response = await client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=100,
            )
            content = response.choices[0].message.content.strip()
            keywords = [w.strip().lower() for w in content.split(",") if w.strip()]
        except Exception:
            pass
    
    # Fallback: local keyword extraction
    if not keywords:
        keywords = extract_keywords(text[:500])
    
    if not keywords:
        keywords = ["unknown"]
    
    # Build embedding: each keyword gets a stable hash-based position in the vector
    # Similar keywords from different texts will activate similar positions
    embedding = [0.0] * 1536
    
    for keyword in keywords:
        # Each keyword deterministically activates a set of positions
        seed = hashlib.md5(keyword.encode()).hexdigest()
        # Activate ~48 positions per keyword (spread across the vector)
        for j in range(24):
            chunk = hashlib.md5(f"{keyword}_{j}".encode()).hexdigest()
            pos = int(chunk[:4], 16) % 1536
            val = (int(chunk[4:6], 16) / 255.0) * 0.5 + 0.5  # value between 0.5-1.0
            embedding[pos] = max(embedding[pos], val)
        
        # Also activate positions for bigrams (pairs with other keywords)
        for other_kw in keywords:
            if other_kw != keyword:
                bigram = f"{min(keyword, other_kw)}_{max(keyword, other_kw)}"
                bigram_hash = hashlib.md5(bigram.encode()).hexdigest()
                pos = int(bigram_hash[:4], 16) % 1536
                embedding[pos] = max(embedding[pos], 0.7)
    
    # Normalize the vector
    magnitude = sum(v * v for v in embedding) ** 0.5
    if magnitude > 0:
        embedding = [v / magnitude for v in embedding]
    
    return embedding