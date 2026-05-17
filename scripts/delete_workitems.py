import requests
import base64
import json

pat = '8aX0NFQONOycIyfSKHIMwxzPHl9tjV7xUI7Y70WhMOnYT25yuCTpJQQJ99CDACAAAAAAAAAAAAASAZDO1HqH'
org = 'suriyaganesh894'
project = 'AiBugTriage'

auth = base64.b64encode(f':{pat}'.encode()).decode()
headers = {
    'Authorization': f'Basic {auth}',
    'Content-Type': 'application/json'
}

wiql_url = f'https://dev.azure.com/{org}/{project}/_apis/wit/wiql?api-version=7.0'
query = 'SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = "Bug"'
response = requests.post(
    wiql_url,
    json={'query': query},
    headers=headers
)
print('Query response:', response.status_code)

if response.status_code == 200:
    items = response.json().get('workItems', [])
    print(f'Found {len(items)} work items')
    
    for item in items:
        wi_id = item['id']
        del_url = f'https://dev.azure.com/{org}/{project}/_apis/wit/workitems/{wi_id}?api-version=7.0'
        del_resp = requests.delete(del_url, headers=headers)
        print(f'Deleted {wi_id}: {del_resp.status_code}')
        
print('Done!')