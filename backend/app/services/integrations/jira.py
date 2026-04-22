from typing import Dict, Any, List, Optional
from app.core.config import settings
import httpx
import base64


class JiraClient:
    def __init__(self, base_url: str, email: str, api_token: str):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.api_token = api_token
        
    def _get_headers(self) -> Dict[str, str]:
        auth = base64.b64encode(f"{self.email}:{self.api_token}".encode()).decode()
        return {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
    
    async def create_issue(self, title: str, description: str,
                          severity: str, bug_type: str,
                          project_key: str) -> Dict[str, Any]:
        """Create a bug issue in JIRA"""
        priority_map = {
            "critical": "Highest",
            "high": "High",
            "medium": "Medium",
            "low": "Low",
        }
        
        issue_type = "Bug"
        
        issue_data = {
            "fields": {
                "project": {"key": project_key},
                "summary": title,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [{
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "text": description,
                        }],
                    }],
                },
                "issuetype": {"name": issue_type},
                "priority": {"name": priority_map.get(severity, "Medium")},
            },
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/rest/api/3/issue",
                json=issue_data,
                headers=self._get_headers(),
                timeout=30.0,
            )
            
            if response.status_code == 201:
                result = response.json()
                return {
                    "success": True,
                    "external_id": result["key"],
                    "url": f"{self.base_url}/browse/{result['key']}",
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                }
    
    async def search_issues(self, project_key: str, 
                           max_results: int = 50) -> List[Dict[str, Any]]:
        """Search for existing issues in JIRA for duplicate detection"""
        jql = f'project = {project_key} ORDER BY created DESC'
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/rest/api/3/search",
                params={"jql": jql, "maxResults": max_results},
                headers=self._get_headers(),
                timeout=30.0,
            )
            
            if response.status_code == 200:
                return response.json().get("issues", [])
            return []
    
    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get available JIRA projects"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/rest/api/3/project",
                headers=self._get_headers(),
                timeout=15.0,
            )
            
            if response.status_code == 200:
                return response.json()
            return []
    
    async def test_connection(self) -> bool:
        """Test if connection is valid"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/rest/api/3/myself",
                    headers=self._get_headers(),
                    timeout=10.0,
                )
                return response.status_code == 200
        except Exception:
            return False


def create_jira_client(base_url: str, email: str, api_token: str) -> Optional[JiraClient]:
    """Factory function to create JIRA client"""
    if not base_url or not email or not api_token:
        return None
    
    return JiraClient(base_url=base_url, email=email, api_token=api_token)
