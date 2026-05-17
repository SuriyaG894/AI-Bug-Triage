import requests

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2IiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsImV4cCI6MTc3ODY2NjA1MX0.IKrCcF4CnDhd3iyHlnyxFtNwjT7CfRIom7L9JCDQsbE"

resp = requests.get(
    'http://localhost:8000/api/admin/my/projects',
    headers={'Authorization': f'Bearer {token}'}
)
print(f'Projects API Status: {resp.status_code}')
if resp.status_code == 200:
    projects = resp.json()
    print(f'Projects count: {len(projects)}')
    for p in projects:
        print(f'  - {p.get("id")}: {p.get("name")}')
else:
    print(f'Error: {resp.text[:500]}')
