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
    from html.parser import HTMLParser
    
    class SafeHTMLParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.allowed_tags = {"b", "strong", "ul", "ol", "li", "em", "u", "p", "br", "span", "div", "a", "i"}
            self.result = []
            self.ignore_content = False
            self.ignore_tags = {"script", "style"}

        def handle_starttag(self, tag, attrs):
            if tag in self.ignore_tags:
                self.ignore_content = True
            elif tag in self.allowed_tags:
                attr_str = ""
                if tag == "a" and attrs:
                    href_attrs = [f'{k}="{v}"' for k, v in attrs if k == "href"]
                    if href_attrs:
                        attr_str = " " + href_attrs[0]
                self.result.append(f"<{tag}{attr_str}>")

        def handle_endtag(self, tag):
            if tag in self.ignore_tags:
                self.ignore_content = False
            elif tag in self.allowed_tags:
                self.result.append(f"</{tag}>")

        def handle_data(self, data):
            if not self.ignore_content:
                self.result.append(data)

        def handle_startendtag(self, tag, attrs):
            if tag == "br" and tag in self.allowed_tags:
                self.result.append("<br/>")

        def get_content(self):
            return "".join(self.result)

    parser = SafeHTMLParser()
    parser.feed(text)
    # Collapse multiple whitespaces but keep HTML structure intact
    content = parser.get_content()
    import re
    content = re.sub(r"[ \t]+", " ", content).strip()
    return content


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


from html.parser import HTMLParser

VOID_ELEMENTS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Node:
    def __init__(self, tag=None, attrs=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children = []

class HTMLTreeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        node = Node(tag, attrs_dict)
        self.stack[-1].children.append(node)
        if tag not in VOID_ELEMENTS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        attrs_dict = dict(attrs)
        node = Node(tag, attrs_dict)
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        if tag in VOID_ELEMENTS:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i].tag == tag:
                while len(self.stack) > i:
                    self.stack.pop()
                break

    def handle_data(self, data):
        if data:
            self.stack[-1].children.append(data)

def serialize(node):
    if isinstance(node, str):
        return node
    
    attrs_str = ""
    for k, v in node.attrs.items():
        attrs_str += f' {k}="{v}"'
        
    tag = node.tag
    if tag == "root":
        return "".join(serialize(c) for c in node.children)
        
    if tag in VOID_ELEMENTS:
        return f"<{tag}{attrs_str} />"
        
    children_str = "".join(serialize(c) for c in node.children)
    return f"<{tag}{attrs_str}>{children_str}</{tag}>"

def get_node_text(node):
    if isinstance(node, str):
        return node
    return "".join(get_node_text(c) for c in node.children)

def is_header_node(node):
    if not isinstance(node, Node):
        return False
        
    if node.tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
        return True
        
    text = get_node_text(node).strip()
    if not text or len(text) > 40:
        return False
        
    if node.tag in ("b", "strong", "u", "span"):
        return True
        
    if node.tag in ("p", "div"):
        non_empty_children = [c for c in node.children if not (isinstance(c, str) and not c.strip())]
        if len(non_empty_children) == 1:
            child = non_empty_children[0]
            if isinstance(child, Node) and child.tag in ("b", "strong", "u", "span"):
                return True
        elif len(non_empty_children) == 0:
            return True
            
    return False

def identify_section(text: str) -> Optional[str]:
    text_clean = re.sub(r'[^a-zA-Z0-9\s]', '', text).strip().lower()
    
    if text_clean in ("description", "desc"):
        return "description"
        
    if any(p in text_clean for p in ("steps to reproduce", "repro steps", "steps", "reproduction steps", "how to reproduce")):
        return "repro_steps"
        
    if any(p in text_clean for p in ("expected result", "expected behavior", "expected state", "expected")):
        return "expected_result"
        
    if any(p in text_clean for p in ("actual result", "actual behavior", "actual state", "actual", "observed result", "observed behavior")):
        return "actual_result"
        
    if "justification" in text_clean:
        return "duplicate_justification"
        
    return None

def is_metadata_table(node):
    if not isinstance(node, Node) or node.tag != "table":
        return False
    text = get_node_text(node).strip()
    return "Priority:" in text or "Severity:" in text

def has_header_descendant(node):
    if not isinstance(node, Node):
        return False
    for child in node.children:
        if is_header_node(child) or has_header_descendant(child):
            return True
    return False

def is_section_header_node(node) -> bool:
    if not isinstance(node, Node):
        return False
    if not is_header_node(node):
        return False
    text = get_node_text(node)
    return identify_section(text) is not None

def contains_section_header(node) -> bool:
    if not isinstance(node, Node):
        return False
    if is_section_header_node(node):
        return True
    return any(contains_section_header(child) for child in node.children)

def flatten_containers(nodes):
    flat = []
    for node in nodes:
        if isinstance(node, Node):
            if is_section_header_node(node):
                flat.append(node)
            elif node.tag in ("div", "p", "span") and any(contains_section_header(child) for child in node.children):
                flat.extend(flatten_containers(node.children))
            else:
                flat.append(node)
        else:
            flat.append(node)
    return flat

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
        
    parser = HTMLTreeParser()
    try:
        parser.feed(html)
        root = parser.root
        
        flat_nodes = flatten_containers(root.children)
            
        current_section = "description"
        sections_content = {
            "description": [],
            "expected_result": [],
            "actual_result": [],
            "repro_steps": [],
            "duplicate_justification": [],
        }
        
        for child in flat_nodes:
            if is_metadata_table(child):
                continue
                
            if isinstance(child, Node):
                if is_section_header_node(child):
                    text_content = get_node_text(child).strip()
                    sec = identify_section(text_content)
                    if sec:
                        current_section = sec
                        continue
            
            sections_content[current_section].append(child)
            
        for k, v in sections_content.items():
            sections[k] = "".join(serialize(c) for c in v).strip()
            
    except Exception:
        sections["description"] = html
        
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

    if "Microsoft.VSTS.TCM.ReproSteps" in fields:
        if not result.get("repro_steps"):
            result["repro_steps"] = strip_html(fields["Microsoft.VSTS.TCM.ReproSteps"])

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
