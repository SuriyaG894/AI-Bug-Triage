import os
os.environ['ADO_PAT'] = '8aX0NFQONOycIyfSKHIMwxzPHl9tjV7xUI7Y70WhMOnYT25yuCTpJQQJ99CDACAAAAAAAAAAAAASAZDO1HqH'
os.environ['AZURE_DEVOPS_ORG'] = 'suriyaganesh894'
os.environ['AZURE_DEVOPS_PROJECT'] = 'AiBugTriage'

import httpx
import base64
import json

auth = base64.b64encode(f':{os.environ["ADO_PAT"]}'.encode()).decode()
headers = {
    'Authorization': f'Basic {auth}',
    'Content-Type': 'application/json'
}

base_url = f'https://dev.azure.com/{os.environ["AZURE_DEVOPS_ORG"]}/{os.environ["AZURE_DEVOPS_PROJECT"]}'

wiql = "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' ORDER BY [System.Id] DESC"

async def test():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/_apis/wit/wiql?api-version=7.0',
            json={'query': wiql},
            headers=headers,
            timeout=30.0
        )
        print('Status:', response.status_code)
        print('Response:', response.text[:500])

import asyncio
asyncio.run(test())