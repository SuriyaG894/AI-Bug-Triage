import asyncio, httpx, json, sys

async def test():
    async with httpx.AsyncClient(base_url='http://localhost:8000', timeout=30.0) as client:
        resp = await client.post('/api/auth/login', json={
            'email': 'admin@test.com',
            'password': 'admin123'
        })
        print(f'Login: {resp.status_code}', flush=True)
        if resp.status_code == 200:
            data = resp.json()
            token = data['access_token']
            resp2 = await client.get(
                '/api/bugs?severity=&type=&status=&search=',
                headers={'Authorization': f'Bearer {token}'}
            )
            print(f'Bugs API: {resp2.status_code}', flush=True)
            if resp2.status_code != 200:
                print(f'Response: {resp2.text[:500]}', flush=True)
            else:
                body = resp2.json()
                print(f'Bugs: {len(body.get("bugs", []))}, Total: {body.get("total")}', flush=True)
        else:
            print(f'Failed: {resp.text[:200]}', flush=True)

asyncio.run(test())
