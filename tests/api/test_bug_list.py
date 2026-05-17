import requests

def test_get_bugs():
    # Attempt to login
    login_data = {
        "email": "test@example.com",
        "password": "test123"
    }
    r = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    if r.status_code == 200:
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get("http://localhost:8000/api/bugs?severity=&type=&status=&search=", headers=headers)
        print("Status:", res.status_code)
        print("Response:", res.text)
    else:
        print("Login failed:", r.status_code, r.text)

test_get_bugs()
