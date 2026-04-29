import asyncio
import os
import sys
import httpx

sys.path.insert(0, "/app")
os.chdir("/app")

from app.services.integrations.azure_devops import AzureDevOpsClient


async def delete_all_bugs():
    client = AzureDevOpsClient(
        org=os.getenv("AZURE_DEVOPS_ORG", "suriyaganesh894"),
        project=os.getenv("AZURE_DEVOPS_PROJECT", "AiBugTriage"),
        pat=os.getenv("ADO_PAT", "")
    )
    
    items = await client.get_work_items()
    bugs = [w for w in items if w.get('type') == 'Bug' or True]
    
    print(f"Found {len(items)} work items")
    
    async with httpx.AsyncClient() as hc:
        for wi in items:
            wid = wi['id']
            print(f"Deleting {wid}...")
            try:
                response = await hc.delete(
                    f"{client.base_url}/_apis/wit/workitems/{wid}?api-version=7.0",
                    headers=client._get_headers(),
                    timeout=30.0,
                )
                if response.status_code in (200, 204):
                    print(f"Deleted {wid}")
                else:
                    print(f"Error {wid}: {response.status_code}")
            except Exception as e:
                print(f"Error {wid}: {e}")
    
    print("Done!")


if __name__ == "__main__":
    asyncio.run(delete_all_bugs())