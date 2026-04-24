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
    if not client:
        print("Could not create client. Check credentials.")
        return
    import httpx
    async with httpx.AsyncClient() as c:
        url = f"{client.base_url}/_apis/wit/workitemtypes/Bug/fields?api-version=7.0"
        r = await c.get(url, headers=client._get_headers())
        if r.status_code == 200:
            fields = r.json().get('value', [])
            with open('ado_fields.txt', 'w') as f:
                for field in fields:
                    f.write(f"{field.get('name')}: {field.get('referenceName')}\n")
            print("Fields written to ado_fields.txt")
        else:
            print(f"Error {r.status_code}: {r.text}")

asyncio.run(main())
