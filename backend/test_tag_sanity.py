"""Sanity test for duplicate justification tag logic"""
import sys

# 1. Simulate Python-side conditions
test_cases = [
    (None, "None"),
    ([], "empty list"),
    (["12345"], "non-empty list"),
    (["12345", "67890"], "multiple IDs"),
]

print("=== Condition: if duplicate_of_external_ids and len(duplicate_of_external_ids) > 0 ===")
for val, desc in test_cases:
    result = bool(val and len(val) > 0)
    status = "Tag ADDED" if result else "Tag NOT added"
    print(f"  val={val!r:20s} ({desc:20s}) -> {status}")

print()

# 2. Verify imports work
print("=== Import verification ===")
try:
    from app.services.integrations.azure_devops import AzureDevOpsClient
    print(f"  PASS: AzureDevOpsClient imported")
except Exception as e:
    print(f"  FAIL: AzureDevOpsClient import: {e}")
    sys.exit(1)

try:
    from app.services.duplicate_detection import find_duplicate_matches
    from app.services.duplicate_detection import _fetch_ado_direct_candidates
    from app.services.duplicate_detection import _fetch_local_candidates
    from app.services.duplicate_detection import DuplicateCandidate
    print(f"  PASS: duplicate_detection imports")
except Exception as e:
    print(f"  FAIL: duplicate_detection import: {e}")
    sys.exit(1)

# 3. Verify DuplicateCandidate accepts external_id
try:
    dc = DuplicateCandidate(
        id=1,
        title="test",
        description="test desc",
        severity="high",
        type="bug",
        status="open",
        source="internal",
        external_id="12345",
    )
    print(f"  PASS: DuplicateCandidate(external_id='12345') -> {dc.external_id}")
except Exception as e:
    print(f"  FAIL: DuplicateCandidate external_id: {e}")
    sys.exit(1)

# 4. Check if ADO env vars are available
import os
has_ado_pat = bool(os.getenv("ADO_PAT"))
has_ado_org = bool(os.getenv("AZURE_DEVOPS_ORG"))
print(f"  ADO PAT configured: {has_ado_pat}")
print(f"  ADO Org configured: {has_ado_org}")

# 5. If ADO credentials available, try a real API call
if has_ado_pat and has_ado_org:
    print("\n=== ADO API test ===")
    import asyncio
    import httpx
    import base64

    org = os.getenv("AZURE_DEVOPS_ORG")
    pat = os.getenv("ADO_PAT")
    project = os.getenv("AZURE_DEVOPS_PROJECT", "AiBugTriage")

    async def test_ado_tag():
        client = AzureDevOpsClient(org=org, pat=pat, project=project)
        # Test with a dummy work item - this should fail with 404
        # but at least we verify the API is reachable
        auth = base64.b64encode(f":{pat}".encode()).decode()
        headers = {"Authorization": f"Basic {auth}"}
        base_url = f"https://dev.azure.com/{org}/{project}"

        # Test GET tags endpoint with clean headers
        url = f"{base_url}/_apis/wit/workitems/1?fields=System.Tags&api-version=7.0"
        async with httpx.AsyncClient() as test_client:
            resp = await test_client.get(url, headers=headers, timeout=10.0)
            print(f"  GET existing workitem with clean headers: {resp.status_code}")
            if resp.status_code == 200:
                print(f"  PASS: Clean headers work for GET")
            elif resp.status_code == 404:
                print(f"  WARN: Work item 1 not found (expected if no such item)")
            else:
                print(f"  INFO: {resp.status_code} - {resp.text[:100]}")

            # Compare: test with _get_headers (has Content-Type)
            bad_headers = client._get_headers()
            resp2 = await test_client.get(url, headers=bad_headers, timeout=10.0)
            print(f"  GET with _get_headers (has Content-Type): {resp2.status_code}")

    asyncio.run(test_ado_tag())

print("\nALL CHECKS PASSED")
