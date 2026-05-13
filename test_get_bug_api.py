import requests

def test_get_bug():
    # Attempt to login
    login_data = {
        "email": "test@example.com",
        "password": "test123"
    }
    # First, let's login
    r = requests.post("http://localhost:8000/api/auth/login", json=login_data)
    
    # If test123 fails, we'll try adminpassword
    if r.status_code != 200:
        login_data["password"] = "adminpassword"
        r = requests.post("http://localhost:8000/api/auth/login", json=login_data)
        
    if r.status_code == 200:
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get("http://localhost:8000/api/bugs/21", headers=headers)
        print("Status:", res.status_code)
        print("Response:", res.text)
    else:
        print("Login failed:", r.status_code, r.text)

test_get_bug()
