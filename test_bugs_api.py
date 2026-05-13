import requests

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2IiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsImV4cCI6MTc3ODY2NjA1MX0.IKrCcF4CnDhd3iyHlnyxFtNwjT7CfRIom7L9JCDQsbE"

resp = requests.get(
    'http://localhost:8000/api/bugs?severity=&type=&status=&search=',
    headers={'Authorization': f'Bearer {token}'}
)
print(f'Status: {resp.status_code}')
if resp.status_code != 200:
    print(f'Error: {resp.text[:500]}')
else:
    data = resp.json()
    print(f'Bugs: {len(data.get("bugs", []))}, Total: {data.get("total")}')
