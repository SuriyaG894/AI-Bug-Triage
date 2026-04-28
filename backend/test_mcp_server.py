import os
os.environ['ADO_PAT'] = '8aX0NFQONOycIyfSKHIMwxzPHl9tjV7xUI7Y70WhMOnYT25yuCTpJQQJ99CDACAAAAAAAAAAAAASAZDO1HqH'
os.environ['AZURE_DEVOPS_ORG'] = 'suriyaganesh894'
os.environ['AZURE_DEVOPS_PROJECT'] = 'AiBugTriage'

from mcp_server import get_config, check_duplicates, list_recent_bugs
import json
import asyncio

async def test():
    print('1. Testing check_duplicates tool...')
    result = await check_duplicates(
        'Login button not working',
        'When clicking login, nothing happens',
        0.5
    )
    print(f'   - Is duplicate: {result.get("is_duplicate")}')
    print(f'   - Results count: {len(result.get("results", []))}')
    
    print('2. Testing list_recent_bugs tool...')
    result = await list_recent_bugs(5)
    print(f'   - Bug count: {result.get("count")}')
    if result.get('bugs'):
        print(f'   - Latest bug: {result["bugs"][0]["title"][:40]}')
    
    print('3. Testing MCP server tools are available...')
    print('   - MCP tools: check_duplicates, list_recent_bugs')
    
    print('\nMCP Server tests completed!')

asyncio.run(test())