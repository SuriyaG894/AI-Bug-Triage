import requests
r = requests.get('http://localhost:8000/api/bugs').json()
bugs = r['bugs']
b = bugs[-1]
print(f'Bug {b["id"]} external_id={b.get("external_id")} attachments={b.get("attachments")}')