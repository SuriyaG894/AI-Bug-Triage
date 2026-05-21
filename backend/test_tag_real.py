"""Test adding a "Justified" tag to a real ADO work item."""
import os, sys, asyncio, base64, httpx

# Add app to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

async def main():
    org = os.getenv("AZURE_DEVOPS_ORG")
    pat = os.getenv("ADO_PAT", os.getenv("AZURE_DEVOPS_PAT"))
    project = os.getenv("AZURE_DEVOPS_PROJECT", "AiBugTriage")

    if not org or not pat:
        print("SKIP: ADO not configured (no ORG/PAT)")
        return

    auth = base64.b64encode(f":{pat}".encode()).decode()
    base_url = f"https://dev.azure.com/{org}/{project}"

    async with httpx.AsyncClient() as client:
        # Step 1: Create a temp work item to test with
        create_url = f"{base_url}/_apis/wit/workitems/%24Bug?api-version=7.0"
        create_body = [
            {"op": "add", "path": "/fields/System.Title", "value": "Temp bug for tag test"},
            {"op": "add", "path": "/fields/System.Description", "value": "<p>Testing tag addition</p>"},
        ]
        create_headers = {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json-patch+json",
        }
        
        print(f"Step 1: Creating test work item at {create_url}")
        resp = await client.patch(create_url, json=create_body, headers=create_headers, timeout=30.0)
        
        if resp.status_code not in (200, 201):
            print(f"FAIL: Create work item: {resp.status_code} {resp.text[:200]}")
            return
        
        item = resp.json()
        item_id = item["id"]
        print(f"  Created work item {item_id}")

        # Step 2: Try setting System.Tags via PATCH (OUR APPROACH)
        print(f"\nStep 2: Setting System.Tags via JSON Patch PATCH...")
        tag_url = f"{base_url}/_apis/wit/workitems/{item_id}?api-version=7.0"
        tag_body = [
            {"op": "add", "path": "/fields/System.Tags", "value": "Justified"}
        ]
        tag_resp = await client.patch(tag_url, json=tag_body, headers=create_headers, timeout=10.0)
        
        if tag_resp.status_code in (200, 201):
            updated = tag_resp.json()
            tags = updated.get("fields", {}).get("System.Tags", "")
            print(f"  SUCCESS: Tags field = '{tags}'")
        else:
            print(f"  FAIL: Tag PATCH: {tag_resp.status_code} {tag_resp.text[:300]}")

        # Step 3: Verify by getting the work item
        print(f"\nStep 3: Verifying via GET...")
        get_headers = {"Authorization": f"Basic {auth}"}
        get_resp = await client.get(
            f"{base_url}/_apis/wit/workitems/{item_id}?fields=System.Tags,System.Title&api-version=7.0",
            headers=get_headers, timeout=10.0
        )
        if get_resp.status_code == 200:
            fields = get_resp.json().get("fields", {})
            print(f"  Title: {fields.get('System.Title')}")
            print(f"  Tags: '{fields.get('System.Tags', '')}'")
            if "Justified" in fields.get("System.Tags", ""):
                print(f"  >>> TAG TEST PASSED: 'Justified' is in ADO work item {item_id}")
            else:
                print(f"  >>> TAG TEST FAILED: 'Justified' NOT found in work item tags")
        else:
            print(f"  FAIL: GET: {get_resp.status_code} {get_resp.text[:200]}")

        # Cleanup: Delete the test work item
        print(f"\nStep 4: Cleaning up work item {item_id}...")
        del_headers = {"Authorization": f"Basic {auth}"}
        del_resp = await client.delete(
            f"{base_url}/_apis/wit/workitems/{item_id}?api-version=7.0",
            headers=del_headers, timeout=10.0
        )
        if del_resp.status_code == 204:
            print(f"  Deleted work item {item_id}")
        else:
            print(f"  Delete: {del_resp.status_code}")

asyncio.run(main())
