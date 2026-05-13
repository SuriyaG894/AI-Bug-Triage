import re
from typing import Dict, Any, Optional
from datetime import datetime


ADO_STATUS_TO_LOCAL = {
    "New": "open",
    "Active": "open",
    "Reopened": "open",
    "Resolved": "resolved",
    "Retest Passed": "resolved",
    "Closed": "closed",
    "Rejected": "closed",
}


ADO_SEVERITY_TO_LOCAL = {
    "1 - Critical": "critical",
    "2 - High": "high",
    "3 - Medium": "medium",
    "4 - Low": "low",
}

LOCAL_SEVERITY_TO_ADO = {
    "critical": "1 - Critical",
    "high": "2 - High",
    "medium": "3 - Medium",
    "low": "4 - Low",
}

LOCAL_PRIORITY_TO_ADO = {
    "critical": 1,
    "high": 2,
    "medium": 3,
    "low": 4,
}


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_ado_timestamp(ado_datestr: Optional[str]) -> Optional[datetime]:
    if not ado_datestr:
        return None
    try:
        if isinstance(ado_datestr, datetime):
            return ado_datestr.replace(tzinfo=None)
        dt = datetime.fromisoformat(ado_datestr.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


def map_ado_state_to_local(ado_state: Optional[str]) -> str:
    if not ado_state:
        return "open"
    return ADO_STATUS_TO_LOCAL.get(ado_state, "open")


def map_ado_severity_to_local(ado_severity: Optional[str]) -> str:
    if not ado_severity:
        return "medium"
    return ADO_SEVERITY_TO_LOCAL.get(ado_severity, "medium")


def parse_ado_description(html: str) -> Dict[str, str]:
    sections = {
        "description": "",
        "expected_result": "",
        "actual_result": "",
        "repro_steps": "",
        "duplicate_justification": "",
    }
    if not html:
        return sections
        
    parts = re.split(r'<h3>(.*?)</h3>', html, flags=re.IGNORECASE)
    if len(parts) == 1:
        sections["description"] = html
        return sections
        
    if parts[0].strip():
        sections["description"] = parts[0].strip()
        
    for i in range(1, len(parts), 2):
        header = parts[i].strip().lower()
        content = parts[i+1] if i+1 < len(parts) else ""
        if "<table>" in content:
            content = content.split("<table>")[0]
            
        if "description" in header:
            sections["description"] = content.strip()
        elif "expected result" in header:
            sections["expected_result"] = content.strip()
        elif "actual result" in header:
            sections["actual_result"] = content.strip()
        elif "steps to reproduce" in header:
            sections["repro_steps"] = content.strip()
        elif "justification" in header:
            sections["duplicate_justification"] = content.strip()
            
    return sections


def ado_to_local(fields: Dict[str, Any]) -> Dict[str, Any]:
    result = {}

    if "System.Title" in fields:
        result["title"] = fields["System.Title"]

    if "System.Description" in fields:
        parsed = parse_ado_description(fields["System.Description"])
        result["description"] = strip_html(parsed["description"])
        result["expected_result"] = strip_html(parsed["expected_result"]) if parsed["expected_result"] and parsed["expected_result"] != "<p>Not provided</p>" else None
        result["actual_result"] = strip_html(parsed["actual_result"]) if parsed["actual_result"] and parsed["actual_result"] != "<p>Not provided</p>" else None
        result["repro_steps"] = strip_html(parsed["repro_steps"]) if parsed["repro_steps"] and parsed["repro_steps"] != "<p>Not provided</p>" else None
        result["duplicate_justification"] = strip_html(parsed["duplicate_justification"]) if parsed["duplicate_justification"] and parsed["duplicate_justification"] != "<p>Not provided</p>" else None

    if "System.State" in fields:
        result["status"] = map_ado_state_to_local(fields["System.State"])

    if "Microsoft.VSTS.Common.Severity" in fields:
        result["severity"] = map_ado_severity_to_local(fields["Microsoft.VSTS.Common.Severity"])

    if "Microsoft.VSTS.Common.Priority" in fields:
        prio_map = {1: "critical", 2: "high", 3: "medium", 4: "low"}
        result["priority"] = prio_map.get(fields["Microsoft.VSTS.Common.Priority"], "medium")

    if "System.AssignedTo" in fields:
        assigned = fields["System.AssignedTo"]
        if isinstance(assigned, dict):
            result["assigned_to"] = assigned.get("displayName", assigned.get("uniqueName", ""))
        else:
            result["assigned_to"] = str(assigned)

    return result
