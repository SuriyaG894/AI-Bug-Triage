from typing import Dict, Any, List, Optional
from app.core.config import settings
import base64
import httpx
import os
import uuid
import urllib.parse


class AzureDevOpsClient:
    def __init__(self, org: str, pat: str, project: str = None):
        self.org = org
        self.project = project
        self.pat = pat
        self.base_url = f"https://dev.azure.com/{org}"
        if project:
            self.base_url = f"{self.base_url}/{project}"
        
    def _get_headers(self) -> Dict[str, str]:
        import base64
        auth = base64.b64encode(f":{self.pat}".encode()).decode()
        return {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json-patch+json",
        }
    
    def _format_attachments(self, attachments: List[Any]) -> str:
        if not attachments:
            return ""
        html = "<ul>"
        for att in attachments:
            if isinstance(att, dict):
                att_url = att.get("url", "")
                name = att.get("name", att_url.split("/")[-1])
                html += f'<li><a href="{att_url}">{name}</a></li>'
            else:
                html += f'<li><a href="{att}">{att.split("/")[-1]}</a></li>'
        html += "</ul>"
        return html
    
    async def create_work_item(self, title: str, description: str,
                               severity: str, bug_type: str,
                               priority_value: str = None,
                               repro_steps: str = None,
                               expected_result: str = None,
                               actual_result: str = None,
                               attachments: List[Any] = None,
                               assigned_to: str = None,
                               duplicate_of_external_ids: List[str] = None,
                               duplicate_justification: str = None,
                               project: str = None) -> Dict[str, Any]:
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

        justification_html = ""
        if duplicate_justification:
            justification_html = f"""
<h3>Justification for Duplicate</h3>
<p>{duplicate_justification}</p>"""

        full_description = f"""<h3>Description</h3>
<p>{description}</p>

<h3>Expected Result</h3>
<p>{expected_result or 'Not provided'}</p>

<h3>Actual Result</h3>
<p>{actual_result or 'Not provided'}</p>

<h3>Steps to Reproduce</h3>
{repro_steps_formatted or '<p>Not provided</p>'}
{justification_html}
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

        work_item_project = project or self.project
        work_item_base_url = f"https://dev.azure.com/{self.org}/{work_item_project}" if work_item_project else f"https://dev.azure.com/{self.org}"

        async with httpx.AsyncClient() as client:
            # Step 1: Create work item WITHOUT attachment (basic fields only)
            work_item_url = f"{work_item_base_url}/_apis/wit/workitems/%24Bug?api-version=7.0"
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

                # Step 2: Now upload and attach files to the newly created work item
                attachment_errors = []
                if attachments:
                    attachment_errors = await self._upload_and_link_attachment(client, work_item_id, attachments, work_item_base_url)

                # Step 3: Add "Justified" tag if this is a justified duplicate
                if duplicate_of_external_ids and len(duplicate_of_external_ids) > 0:
                    await self._add_work_item_tag(client, work_item_id, "Justified", work_item_base_url)

                result_dict = {
                    "success": True,
                    "external_id": str(result["id"]),
                    "url": url,
                    "message": f"Created work item {result['id']}",
                }
                if attachment_errors:
                    result_dict["attachment_errors"] = attachment_errors
                    result_dict["message"] += f" | {len(attachment_errors)} attachment(s) failed"
                return result_dict
            else:
                print(f"Azure DevOps API Error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to create work item: {response.status_code} - {response.text[:200]}",
                }

    async def update_work_item(self, external_id: str, title: str, description: str,
                                severity: str, bug_type: str,
                                priority_value: str = None,
                                repro_steps: str = None,
                                expected_result: str = None,
                                actual_result: str = None,
                                attachments: List[Any] = None,
                                assigned_to: str = None,
                                duplicate_of_external_ids: List[str] = None,
                                duplicate_justification: str = None,
                                project: str = None) -> Dict[str, Any]:
        """Update an existing work item in Azure DevOps via PATCH"""

        severity_value_map = {
            "critical": "1 - Critical", "high": "2 - High",
            "medium": "3 - Medium", "low": "4 - Low",
        }

        priority_value_map = {
            "critical": 1, "high": 2, "medium": 3, "low": 4,
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

        justification_html = ""
        if duplicate_justification:
            justification_html = f"""
<h3>Justification for Duplicate</h3>
<p>{duplicate_justification}</p>"""

        full_description = f"""<h3>Description</h3>
<p>{description}</p>

<h3>Expected Result</h3>
<p>{expected_result or 'Not provided'}</p>

<h3>Actual Result</h3>
<p>{actual_result or 'Not provided'}</p>

<h3>Steps to Reproduce</h3>
{repro_steps_formatted or '<p>Not provided</p>'}
{justification_html}
<table>
<tr><td><b>Priority:</b></td><td>{priority_value or 'Not set'}</td></tr>
<tr><td><b>Severity:</b></td><td>{severity}</td></tr>
</table>"""

        fields = [
            {"op": "replace", "path": "/fields/System.Title", "value": title},
            {"op": "replace", "path": "/fields/System.Description", "value": full_description},
            {"op": "replace", "path": "/fields/Microsoft.VSTS.Common.Severity", "value": severity_value_map.get(severity, "3 - Medium")},
            {"op": "replace", "path": "/fields/Microsoft.VSTS.Common.Priority", "value": priority_value_map.get(priority_value, 2)},
        ]

        if assigned_to:
            fields.append({"op": "replace", "path": "/fields/System.AssignedTo", "value": assigned_to})

        work_item_project = project or self.project
        work_item_base_url = f"https://dev.azure.com/{self.org}/{work_item_project}" if work_item_project else f"https://dev.azure.com/{self.org}"

        async with httpx.AsyncClient() as client:
            work_item_url = f"{work_item_base_url}/_apis/wit/workitems/{external_id}?api-version=7.0"
            response = await client.patch(
                work_item_url,
                json=fields,
                headers=self._get_headers(),
                timeout=30.0,
            )

            if response.status_code in [200, 201]:
                result = response.json()
                links = result.get("_links", {})
                url = links.get("html", {}).get("href", links.get("web", {}).get("href", ""))

                attachment_errors = []
                if attachments:
                    attachment_errors = await self._upload_and_link_attachment(client, int(external_id), attachments, work_item_base_url)

                result_dict = {
                    "success": True,
                    "external_id": str(external_id),
                    "url": url,
                    "message": f"Updated work item {external_id}",
                }
                if attachment_errors:
                    result_dict["attachment_errors"] = attachment_errors
                    result_dict["message"] += f" | {len(attachment_errors)} attachment(s) failed"
                return result_dict
            else:
                return {
                    "success": False,
                    "message": f"Failed to update work item: {response.status_code} - {response.text[:200]}",
                }

    async def delete_work_item(self, external_id: str, project: str = None) -> Dict[str, Any]:
        """Delete a work item from Azure DevOps (moves to recycle bin)"""
        work_item_project = project or self.project
        base = f"https://dev.azure.com/{self.org}/{work_item_project}" if work_item_project else f"https://dev.azure.com/{self.org}"
        url = f"{base}/_apis/wit/workitems/{external_id}?api-version=7.0"

        async with httpx.AsyncClient() as client:
            import base64
            auth = base64.b64encode(f":{self.pat}".encode()).decode()
            headers = {
                "Authorization": f"Basic {auth}",
            }
            response = await client.delete(url, headers=headers, timeout=30.0)

            if response.status_code == 204:
                return {"success": True, "message": f"Deleted work item {external_id}"}
            else:
                return {"success": False, "message": f"Failed to delete work item: {response.status_code}"}

    async def _upload_and_link_attachment(self, client: httpx.AsyncClient, work_item_id: int, attachments: List[Any], base_url: str = None) -> List[str]:
        """Upload attachment to Azure DevOps and link to work item AFTER work item is created.
        
        Returns a list of error messages. Empty list means all attachments succeeded.
        """
        target_base = base_url or self.base_url
        errors = []

        if not attachments:
            return errors

        for att in attachments:
            if not att:
                continue

            if isinstance(att, dict):
                att_url = att.get("url", "")
                original_filename = att.get("name", "")
                content_base64 = att.get("content_base64", "")
            else:
                att_url = att
                original_filename = ""
                content_base64 = ""

            if not original_filename:
                file_path = att_url.replace("/api/uploads/", "")
                ext = os.path.splitext(file_path)[1].lower()
                original_filename = f"bug_screenshot{ext}"

            # Prefer base64 content from DB, fallback to disk
            if content_base64:
                try:
                    file_content = base64.b64decode(content_base64)
                except Exception as e:
                    errors.append(f"Failed to decode {original_filename}: {e}")
                    continue
            else:
                file_path_from_url = att_url.replace("/api/uploads/", "")
                full_path = os.path.join("uploads", file_path_from_url)
                if not os.path.exists(full_path):
                    errors.append(f"File not found on disk: {full_path}")
                    continue
                try:
                    with open(full_path, "rb") as f:
                        file_content = f.read()
                except Exception as e:
                    errors.append(f"Failed to read {full_path}: {e}")
                    continue

            encoded_filename = urllib.parse.quote(original_filename)
            attach_api_url = f"{target_base}/_apis/wit/attachments?fileName={encoded_filename}&api-version=7.0"

            try:
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

                    # Add to relations (Attachments tab)
                    patch_url = f"{target_base}/_apis/wit/workitems/{work_item_id}?api-version=7.0"

                    patch_response = await client.patch(
                        patch_url,
                        json=[{
                            "op": "add",
                            "path": "/relations/-",
                            "value": {
                                "rel": "AttachedFile",
                                "url": f"{target_base}/_apis/wit/attachments/{att_id}",
                                "attributes": {
                                    "name": original_filename,
                                    "comment": original_filename
                                }
                            }
                        }],
                        headers=self._get_headers(),
                        timeout=30.0,
                    )

                    if patch_response.status_code not in [200, 201]:
                        errors.append(f"Failed to link {original_filename} to work item: {patch_response.status_code}")
                else:
                    try:
                        detail = attach_response.text[:200]
                    except Exception:
                        detail = str(attach_response.status_code)
                    errors.append(f"ADO upload failed for {original_filename}: {detail}")
            except Exception as e:
                errors.append(f"Error uploading {original_filename}: {e}")

        return errors
    
    async def _add_work_item_tag(self, client: httpx.AsyncClient, work_item_id: int, tag: str, base_url: str = None) -> None:
        """Add a tag to the work item"""
        target_base = base_url or self.base_url
        try:
            # Get current tags
            get_url = f"{target_base}/_apis/wit/workitems/{work_item_id}?fields=System.Tags&api-version=7.0"
            response = await client.get(get_url, headers=self._get_headers(), timeout=10.0)

            if response.status_code == 200:
                data = response.json()
                current_tags = data.get("fields", {}).get("System.Tags", "")

                # Append new tag
                if current_tags:
                    new_tags = f"{current_tags};{tag}"
                else:
                    new_tags = tag

                # Update tags
                patch_url = f"{target_base}/_apis/wit/workitems/{work_item_id}?api-version=7.0"
                patch_fields = [
                    {"op": "add", "path": "/fields/System.Tags", "value": new_tags}
                ]
                patch_response = await client.patch(
                    patch_url,
                    json=patch_fields,
                    headers=self._get_headers(),
                    timeout=10.0,
                )

                if patch_response.status_code in [200, 201]:
                    print(f"Added tag '{tag}' to work item {work_item_id}")
                else:
                    print(f"Failed to add tag: {patch_response.status_code}")
            else:
                print(f"Failed to get work item tags: {response.status_code}")
        except Exception as e:
            print(f"Error adding tag: {e}")
    
    async def get_work_items(self, states: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Get existing work items for duplicate detection"""
        wiql = "SELECT [System.Id], [System.Title], [System.Description], [System.State] FROM WorkItems"
        if states:
            state_filter = " OR ".join([f"[System.State] = '{s}'" for s in states])
            wiql += f" WHERE ({state_filter})"
        wiql += " ORDER BY [System.Id] DESC"
        
        async with httpx.AsyncClient() as client:
            headers = self._get_headers()
            headers["Content-Type"] = "application/json"
            response = await client.post(
                f"{self.base_url}/_apis/wit/wiql?api-version=7.0",
                json={"query": wiql},
                headers=headers,
                timeout=30.0,
            )
            
            if response.status_code == 200:
                return response.json().get("workItems", [])
            return []
    
    async def get_work_item_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Fetch full work item details including all fields."""
        target_base = f"https://dev.azure.com/{self.org}"
        if self.project:
            target_base = f"{target_base}/{self.project}"
        url = f"{target_base}/_apis/wit/workitems/{external_id}?$expand=all&api-version=7.0"

        async with httpx.AsyncClient() as client:
            auth = base64.b64encode(f":{self.pat}".encode()).decode()
            headers = {"Authorization": f"Basic {auth}"}
            response = await client.get(url, headers=headers, timeout=30.0)

            if response.status_code == 200:
                return response.json()
        return None

    async def get_work_item_comments(self, external_id: str, top: int = 100) -> List[Dict[str, Any]]:
        """Fetch comments/discussion from an ADO work item."""
        target_base = f"https://dev.azure.com/{self.org}"
        if self.project:
            target_base = f"{target_base}/{self.project}"
        url = f"{target_base}/_apis/wit/workitems/{external_id}/comments?api-version=7.1-preview&$top={top}"

        async with httpx.AsyncClient() as client:
            auth = base64.b64encode(f":{self.pat}".encode()).decode()
            headers = {"Authorization": f"Basic {auth}"}
            response = await client.get(url, headers=headers, timeout=30.0)

            if response.status_code == 200:
                return response.json().get("comments", [])
        return []

    async def get_work_item_revisions(self, external_id: str, since: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch revisions/updates of a work item (for delta sync)."""
        target_base = f"https://dev.azure.com/{self.org}"
        if self.project:
            target_base = f"{target_base}/{self.project}"
        url = f"{target_base}/_apis/wit/workitems/{external_id}/updates?api-version=7.0"

        async with httpx.AsyncClient() as client:
            auth = base64.b64encode(f":{self.pat}".encode()).decode()
            headers = {"Authorization": f"Basic {auth}"}
            response = await client.get(url, headers=headers, timeout=30.0)

            if response.status_code == 200:
                revisions = response.json().get("value", [])
                if since:
                    filtered = []
                    for rev in revisions:
                        rev_date = rev.get("fields", {}).get("System.ChangedDate", {}).get("newValue", "")
                        if rev_date >= since:
                            filtered.append(rev)
                    return filtered
                return revisions
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


def create_azure_client(credentials: str = "", project: str = None, org: str = None) -> Optional[AzureDevOpsClient]:
    """Factory function to create Azure DevOps client"""
    pat = credentials or settings.AZURE_DEVOPS_PAT

    if pat.startswith("ENC:"):
        from app.core.config import decrypt_api_key
        pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)

    org = org or settings.AZURE_DEVOPS_ORG

    if not pat or not org:
        return None

    return AzureDevOpsClient(
        org=org,
        project=project or settings.AZURE_DEVOPS_PROJECT,
        pat=pat,
    )


async def get_active_ado_config(db) -> Optional[Dict[str, str]]:
    """Fetch active ADO integration config from DB. Returns {org, pat, project} or None."""
    from app.core.database import Integration
    from app.core.config import decrypt_api_key
    from sqlalchemy import select

    result = await db.execute(
        select(Integration).where(Integration.tool_type == "azure_devops", Integration.is_active == True)
    )
    integration = result.scalar_one_or_none()

    if not integration or not integration.credentials:
        return None

    config = integration.config or {}
    pat = integration.credentials
    if pat.startswith("ENC:"):
        pat = decrypt_api_key(pat, "bug-triage-app-key")

    return {
        "org": config.get("org"),
        "pat": pat,
        "project": config.get("project"),
    }