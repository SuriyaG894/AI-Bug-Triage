from typing import Dict, Any, List, Optional
from app.core.config import settings
import httpx
import os
import uuid


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
            "Content-Type": "application/json-patch+json",
        }
    
    def _format_attachments(self, attachments: List[str]) -> str:
        if not attachments:
            return ""
        html = "<ul>"
        for att in attachments:
            html += f'<li><a href="{att}">{att.split("/")[-1]}</a></li>'
        html += "</ul>"
        return html
    
    async def create_work_item(self, title: str, description: str, 
                               severity: str, bug_type: str,
                               priority_value: str = None,
                               repro_steps: str = None,
                               expected_result: str = None,
                               actual_result: str = None,
                               attachments: List[str] = None,
                               assigned_to: str = None) -> Dict[str, Any]:
        """Create a work item in Azure DevOps"""
        severity_value_map = {
            "critical": "1 - Critical",
            "high": "2 - High",
            "medium": "3 - Medium",
            "low": "4 - Low",
        }
        
        priority_value_map = {
            "critical": 1,
            "high": 2,
            "medium": 3,
            "low": 4,
        }
        
        repro_steps_formatted = ""
        if repro_steps:
            steps = repro_steps.strip().split('\n')
            repro_steps_formatted = "<ul>"
            for step in steps:
                step = step.strip()
                if step:
                    if step.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
                        step = step[2:].strip()
                    repro_steps_formatted += f"<li>{step}</li>"
            repro_steps_formatted += "</ul>"
        
        full_description = f"""<h3>Description</h3>
<p>{description}</p>

<h3>Expected Result</h3>
<p>{expected_result or 'Not provided'}</p>

<h3>Actual Result</h3>
<p>{actual_result or 'Not provided'}</p>

<h3>Steps to Reproduce</h3>
{repro_steps_formatted or '<p>Not provided</p>'}

<table>
<tr><td><b>Priority:</b></td><td>{priority_value or 'Not set'}</td></tr>
<tr><td><b>Severity:</b></td><td>{severity}</td></tr>
</table>"""
        
        fields = [
            {"op": "add", "path": "/fields/System.Title", "value": title},
            {"op": "add", "path": "/fields/System.Description", "value": full_description},
            {"op": "add", "path": "/fields/Microsoft.VSTS.Common.Severity", "value": severity_value_map.get(severity, "3 - Medium")},
            {"op": "add", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": priority_value_map.get(priority_value, 2)},
        ]
        
        if assigned_to:
            fields.append({"op": "add", "path": "/fields/System.AssignedTo", "value": assigned_to})
        
        async with httpx.AsyncClient() as client:
            # Step 1: Create work item WITHOUT attachment (basic fields only)
            work_item_url = f"{self.base_url}/_apis/wit/workitems/%24Bug?api-version=7.0"
            response = await client.patch(
                work_item_url,
                json=fields,
                headers=self._get_headers(),
                timeout=30.0,
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                work_item_id = result["id"]
                links = result.get("_links", {})
                url = links.get("html", {}).get("href", links.get("web", {}).get("href", ""))
                
                print(f"Work item {work_item_id} created successfully")
                
                # Step 2: Now upload and attach files to the newly created work item
                if attachments and len(attachments) > 0 and attachments[0] != "No attachments":
                    await self._upload_and_link_attachment(client, work_item_id, attachments)
                
                return {
                    "success": True,
                    "external_id": str(result["id"]),
                    "url": url,
                    "message": f"Created work item {result['id']}",
                }
            else:
                print(f"Azure DevOps API Error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to create work item: {response.status_code} - {response.text[:200]}",
                }
    
    async def _upload_and_link_attachment(self, client: httpx.AsyncClient, work_item_id: int, attachments: List[str]) -> None:
        """Upload attachment to Azure DevOps and link to work item AFTER work item is created"""
        if not attachments or attachments[0] == "No attachments":
            return
        
        for att_url in attachments:
            if not att_url:
                continue
            
            file_path = att_url.replace("/api/uploads/", "")
            full_path = os.path.join("uploads", file_path)
            
            if not os.path.exists(full_path):
                print(f"File not found: {full_path}")
                continue
            
            ext = os.path.splitext(file_path)[1].lower()
            original_filename = f"bug_screenshot{ext}"
            attach_api_url = f"{self.base_url}/_apis/wit/attachments?fileName={original_filename}&api-version=7.0"
            
            try:
                with open(full_path, "rb") as f:
                    file_content = f.read()
                
                # Use application/octet-stream which is required by Azure DevOps
                import base64
                auth = base64.b64encode(f":{self.pat}".encode()).decode()
                upload_headers = {
                    "Authorization": f"Basic {auth}",
                    "Content-Type": "application/octet-stream",
                }
                
                attach_response = await client.post(
                    attach_api_url,
                    content=file_content,
                    headers=upload_headers,
                    timeout=120.0,
                )
                
                if attach_response.status_code == 201:
                    attach_data = attach_response.json()
                    att_id = attach_data.get("id")
                    att_url = attach_data.get("url", "")
                    
                    print(f"Step 1 - Uploaded {original_filename}, ID: {att_id}, URL: {att_url}")
                    
                    # Add to relations (Appears in Attachments tab)
                    patch_url = f"{self.base_url}/_apis/wit/workitems/{work_item_id}?api-version=7.0"
                    
                    patch_response = await client.patch(
                        patch_url,
                        json=[{
                            "op": "add",
                            "path": "/relations/-",
                            "value": {
                                "rel": "AttachedFile",
                                "url": f"{self.base_url}/_apis/wit/attachments/{att_id}",
                                "attributes": {
                                    "comment": original_filename
                                }
                            }
                        }],
                        headers=self._get_headers(),
                        timeout=30.0,
                    )
                    
                    print(f"Step 2 - PATCH response: {patch_response.status_code}")
                    
                    print(f"Step 2 - PATCH response: {patch_response.status_code} - {patch_response.text[:150]}")
                    
                    if patch_response.status_code in [200, 201]:
                        print(f"Attachment {original_filename} (ID: {att_id}) linked to work item {work_item_id}")
                else:
                    print(f"Failed to upload {original_filename}: {attach_response.status_code}")
            except Exception as e:
                print(f"Error uploading {original_filename}: {e}")

    async def _upload_attachments(self, client: httpx.AsyncClient, work_item_id: int, attachments: List[str]) -> List[str]:
        """Upload attachments to Azure DevOps and return URLs"""
        uploaded_urls = []
        
        for att_url in attachments:
            if not att_url or att_url == "No attachments":
                continue
            
            filename = att_url.split("/")[-1]
            file_path = att_url.replace("/api/uploads/", "")
            full_path = os.path.join("uploads", file_path)
            
            if os.path.exists(full_path):
                try:
                    with open(full_path, "rb") as f:
                        file_content = f.read()
                    
                    attach_api_url = f"{self.base_url}/_apis/wit/attachments?fileName={filename}&api-version=7.0"
                    
                    attach_response = await client.post(
                        attach_api_url,
                        content=file_content,
                        headers={
                            **self._get_headers(),
                            "Content-Type": "application/octet-stream",
                        },
                        timeout=120.0,
                    )
                    
                    if attach_response.status_code in [200, 201]:
                        attach_data = attach_response.json()
                        attachment_url = attach_data.get("url")
                        if attachment_url:
                            uploaded_urls.append(attachment_url)
                        print(f"Uploaded attachment: {filename}")
                except Exception as e:
                    print(f"Attachment upload error for {filename}: {e}")
        
        return uploaded_urls
    
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


def create_azure_client(credentials: str = "") -> Optional[AzureDevOpsClient]:
    """Factory function to create Azure DevOps client"""
    pat = credentials or settings.AZURE_DEVOPS_PAT
    
    if pat.startswith("ENC:"):
        from app.core.config import decrypt_api_key
        pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)
    
    if not pat or not settings.AZURE_DEVOPS_ORG or not settings.AZURE_DEVOPS_PROJECT:
        return None
    
    return AzureDevOpsClient(
        org=settings.AZURE_DEVOPS_ORG,
        project=settings.AZURE_DEVOPS_PROJECT,
        pat=pat,
    )