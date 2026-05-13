import requests
resp = requests.post('http://localhost:8000/api/auth/login', json={'email': 'admin@test.com', 'password': 'admin123'})
print(f'Login: {resp.status_code}')
if resp.status_code == 200:
    token = resp.json()['access_token']
    resp2 = requests.get('http://localhost:8000/api/bugs?severity=&type=&status=&search=', headers={'Authorization': f'Bearer {token}'})
    print(f'Bugs API: {resp2.status_code}')
    if resp2.status_code != 200:
        print(f'Error: {resp2.text[:1000]}')
    else:
        d = resp2.json()
        print(f'Bugs count: {len(d.get("bugs", []))}, Total: {d.get("total")}')
