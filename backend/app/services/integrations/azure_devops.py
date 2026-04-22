from typing import Dict, Any, List, Optional
from app.core.config import settings
import httpx


class AzureDevOpsClient:
    def __init__(self, org: str, project: str, pat: str):
        self.org = org
        self.project = project
        self.pat = pat
        self.base_url = f"https://dev.azure.com/{org}/{project}"
        
    def _get_headers(self) -> Dict[str, str]:
        import base64
        auth = base64.b64encode(f":{self.pat}".encode()).decode()
        return {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        }
    
    async def create_work_item(self, title: str, description: str, 
                               severity: str, bug_type: str) -> Dict[str, Any]:
        """Create a bug work item in Azure DevOps"""
        work_item_type = "Bug"
        
        # Map severity to Azure DevOps priority
        priority_map = {
            "critical": 1,
            "high": 2,
            "medium": 3,
            "low": 4,
        }
        
        fields = {
            "System.Title": title,
            "System.Description": description,
            "System.WorkItemType": work_item_type,
            "Microsoft.VSTS.Severity": priority_map.get(severity, 3),
            "Custom.BugType": bug_type,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/_apis/wit/workitems/$Bug",
                json=[{"op": "add", "path": "/fields", "value": fields}],
                headers=self._get_headers(),
                timeout=30.0,
            )
            
            if response.status_code == 201:
                result = response.json()
                return {
                    "success": True,
                    "external_id": str(result["id"]),
                    "url": result["_links"]["web"]["href"],
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                }
    
    async def get_work_items(self, states: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get existing work items for duplicate detection"""
        wiql = "SELECT [System.Id], [System.Title], [System.Description], [System.State] FROM WorkItems"
        if states:
            state_filter = " OR ".join([f"[System.State] = '{s}'" for s in states])
            wiql += f" WHERE ({state_filter})"
        wiql += " ORDER BY [System.Id] DESC"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/_apis/wit/wiql?api-version=7.0",
                json={"query": wiql},
                headers=self._get_headers(),
                timeout=30.0,
            )
            
            if response.status_code == 200:
                return response.json().get("workItems", [])
            return []
    
    async def test_connection(self) -> bool:
        """Test if connection is valid"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://dev.azure.com/{self.org}/_apis/projects?api-version=7.0",
                    headers=self._get_headers(),
                    timeout=10.0,
                )
                return response.status_code == 200
        except Exception:
            return False


def create_azure_client(credentials: str) -> Optional[AzureDevOpsClient]:
    """Factory function to create Azure DevOps client"""
    if not credentials or not settings.AZURE_DEVOPS_ORG or not settings.AZURE_DEVOPS_PROJECT:
        return None
    
    return AzureDevOpsClient(
        org=settings.AZURE_DEVOPS_ORG,
        project=settings.AZURE_DEVOPS_PROJECT,
        pat=credentials,
    )