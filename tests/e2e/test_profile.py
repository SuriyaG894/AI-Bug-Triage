from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    print("1. Testing /profile without login...")
    page.goto("http://localhost:5173/profile")
    page.wait_for_load_state("networkidle")
    
    current_url = page.url
    redirected = "login" in current_url
    print(f"   - Redirected to login: {'OK' if redirected else 'FAILED (at ' + current_url + ')'}")
    
    print("2. Testing /profile after login...")
    page.goto("http://localhost:5173/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'test123')
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    
    page.goto("http://localhost:5173/profile")
    page.wait_for_load_state("networkidle")
    current_url = page.url
    print(f"   - Profile page accessible: {'OK' if 'profile' in current_url else 'FAILED (at ' + current_url + ')'}")
    
    # Check if email is displayed
    email_shown = page.locator('text=test@example.com').count()
    print(f"   - Email displayed: {'OK' if email_shown else 'FAILED'}")
    
    page.screenshot(path="profile_test.png")
    print("   - Screenshot saved")
    
    print("3. Testing logout button...")
    page.click('button:has-text("Logout")')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    
    # Should redirect to login
    current_url = page.url
    redirected = "login" in current_url
    print(f"   - Logout redirects to login: {'OK' if redirected else 'FAILED (at ' + current_url + ')'}")
    
    print("\nAll profile tests completed!")
    browser.close()