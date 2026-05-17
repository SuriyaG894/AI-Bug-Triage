from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    print("1. Testing / (dashboard) without login...")
    page.goto("http://localhost:5173/")
    page.wait_for_load_state("networkidle")
    current_url = page.url
    redirected = "login" in current_url
    print(f"   - Redirected to login: {'OK' if redirected else 'FAILED (at ' + current_url + ')'}")
    
    print("2. Testing /bugs without login...")
    page.goto("http://localhost:5173/bugs")
    page.wait_for_load_state("networkidle")
    current_url = page.url
    redirected = "login" in current_url
    print(f"   - Redirected to login: {'OK' if redirected else 'FAILED (at ' + current_url + ')'}")
    
    print("3. Testing /settings without login...")
    page.goto("http://localhost:5173/settings")
    page.wait_for_load_state("networkidle")
    current_url = page.url
    redirected = "login" in current_url
    print(f"   - Redirected to login: {'OK' if redirected else 'FAILED (at ' + current_url + ')'}")
    
    print("4. Testing /login is accessible...")
    page.goto("http://localhost:5173/login")
    page.wait_for_load_state("networkidle")
    current_url = page.url
    accessible = "login" in current_url
    print(f"   - Login page accessible: {'OK' if accessible else 'FAILED'}")
    
    print("5. Testing /register is accessible...")
    page.goto("http://localhost:5173/register")
    page.wait_for_load_state("networkidle")
    current_url = page.url
    accessible = "register" in current_url
    print(f"   - Register page accessible: {'OK' if accessible else 'FAILED'}")
    
    print("6. Testing / after login...")
    page.goto("http://localhost:5173/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'test123')
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    
    current_url = page.url
    accessible = current_url == "http://localhost:5173/"
    print(f"   - Dashboard accessible after login: {'OK' if accessible else 'FAILED (at ' + current_url + ')'}")
    
    print("\nAll tests completed!")
    browser.close()