import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(base_url='http://localhost:8000') as client:
        resp = await client.post('/api/auth/login', json={
            'email': 'admin@test.com',
            'password': 'admin123'
        })
        print(f'Login status: {resp.status_code}')
        if resp.status_code == 200:
            data = resp.json()
            token = data['access_token']
            print(f'Token: {token[:50]}...')

            resp2 = await client.get(
                '/api/bugs?severity=&type=&status=&search=',
                headers={'Authorization': f'Bearer {token}'}
            )
            print(f'Bugs API status: {resp2.status_code}')
            if resp2.status_code != 200:
                print(f'Bugs API error: {resp2.text[:500]}')
            else:
                body = resp2.json()
                print(f'Bugs returned: {len(body.get("bugs", []))}, total: {body.get("total")}')
        else:
            print(f'Login failed: {resp.text}')

asyncio.run(test())
