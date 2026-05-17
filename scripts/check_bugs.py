import requests
r = requests.get('http://localhost:8000/api/bugs?limit=5')
if r.status_code == 200:
    data = r.json()
    print('Total:', data['total'])
    print('Latest bugs:')
    for bug in data['bugs'][:5]:
        print(f'  ID {bug["id"]}: {bug["title"][:40]} - by {bug.get("created_by")}')