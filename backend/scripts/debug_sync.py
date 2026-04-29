import asyncio
import os
import sys

sys.path.insert(0, "/app")
os.chdir("/app")

from app.services.integrations.azure_devops import create_azure_client
from app.core.config import settings, decrypt_api_key


async def debug():
    import httpx
    import base64
    
    pat = settings.AZURE_DEVOPS_PAT
    if pat.startswith("ENC:"):
        pat = decrypt_api_key(pat, settings.ENCRYPTION_KEY)
    
    org = settings.AZURE_DEVOPS_ORG
    project = settings.AZURE_DEVOPS_PROJECT
    base_url = f"https://dev.azure.com/{org}/{project}"
    
    auth = base64.b64encode(f":{pat}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        wiql = "SELECT [System.Id], [System.Title], [System.Description] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' ORDER BY [System.Id] DESC"
        response = await client.post(
            f"{base_url}/_apis/wit/wiql?api-version=7.0",
            json={"query": wiql},
            headers=headers,
            timeout=30.0
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:1000]}")


if __name__ == "__main__":
    asyncio.run(debug())