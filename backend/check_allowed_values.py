import os
import sys
import asyncio
from dotenv import load_dotenv

# Load from .env
load_dotenv()

sys.path.append(os.getcwd())
from app.services.integrations.azure_devops import create_azure_client

async def main():
    client = create_azure_client()
    import httpx
    async with httpx.AsyncClient() as c:
        for field in ['Microsoft.VSTS.Common.Severity', 'Microsoft.VSTS.Common.Priority']:
            url = f"{client.base_url}/_apis/wit/workitemtypes/Bug/fields/{field}?$expand=allowedValues&api-version=7.0"
            r = await c.get(url, headers=client._get_headers())
            if r.status_code == 200:
                data = r.json()
                print(f"{field} allowed values: {data.get('allowedValues', [])}")
            else:
                print(f"Error {r.status_code} for {field}")

asyncio.run(main())
