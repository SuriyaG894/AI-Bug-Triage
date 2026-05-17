from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    print("1. Testing login with existing user...")
    page.goto("http://localhost:5173/login")
    page.wait_for_load_state("networkidle")
    
    # Use existing test credentials
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'test123')
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Check if redirected to home (successful login)
    current_url = page.url
    print(f"   - Redirected after login: {'OK' if current_url == 'http://localhost:5173/' else 'At ' + current_url}")
    
    # Check if logged in (header shows email and logout button)
    email_display = page.locator('text=test@example.com').count()
    logout_btn = page.locator('button:has-text("Logout")').count()
    print(f"   - Email shown in header: {'OK' if email_display else 'FAILED'}")
    print(f"   - Logout button shown: {'OK' if logout_btn else 'FAILED'}")
    
    print("2. Testing protected route access...")
    page.goto("http://localhost:5173/bugs/new")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    
    # Should NOT redirect to login (we're logged in)
    current_url = page.url
    is_new_bug_page = "/bugs/new" in current_url
    print(f"   - Can access /bugs/new: {'OK' if is_new_bug_page else 'FAILED (at ' + current_url + ')'}")
    
    print("3. Taking screenshot...")
    page.screenshot(path="tests/e2e/assets/login_test.png")
    print("   - Screenshot saved")
    
    print("\nAll tests completed!")
    browser.close()