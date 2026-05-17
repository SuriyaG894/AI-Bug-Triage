import os
import sys
sys.path.insert(0, 'backend')

os.environ['ADO_PAT'] = '8aX0NFQONOycIyfSKHIMwxzPHl9tjV7xUI7Y70WhMOnYT25yuCTpJQQJ99CDACAAAAAAAAAAAAASAZDO1HqH'
os.environ['AZURE_DEVOPS_ORG'] = 'suriyaganesh894'
os.environ['AZURE_DEVOPS_PROJECT'] = 'AiBugTriage'

import mcp_server
mcp_server.config = mcp_server.get_config()

import asyncio
from mcp_server import search_ado_duplicates
import json

async def test():
    result = await search_ado_duplicates(
        "Submit button hangs on checkout page",
        "Button hangs",
        0.5
    )
    print(json.dumps(result, indent=2))

asyncio.run(test())