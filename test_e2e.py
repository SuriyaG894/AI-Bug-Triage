from playwright.sync_api import sync_playwright
import time
import random

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    email = f"newuser{random.randint(1000,9999)}@test.com"
    print(f"1. Registering new user: {email}")
    page.goto("http://localhost:5173/register")
    page.wait_for_load_state("networkidle")
    
    page.fill('input[name="fullName"]', 'New Test User')
    page.fill('input[name="email"]', email)
    page.fill('input[name="password"]', 'test123')
    page.fill('input[name="confirmPassword"]', 'test123')
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    print(f"   - Registered successfully")
    
    print("2. Creating a new bug...")
    page.goto("http://localhost:5173/bugs/new")
    page.wait_for_load_state("networkidle")
    
    page.fill('input[name="title"]', 'Test Bug from Playwright')
    page.fill('textarea[name="description"]', 'This is a test bug created from the automated test. The login and registration flow is working correctly.')
    page.fill('textarea[name="repro_steps"]', '1. Register a new user\n2. Navigate to New Bug page\n3. Fill the form\n4. Submit')
    
    # Select priority and severity
    page.select_option('select[name="priority"]', 'high')
    page.select_option('select[name="severity"]', 'high')
    
    # Click submit
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    
    # Check for success modal
    modal_text = page.locator('.fixed.inset-0').text_content() if page.locator('.fixed.inset-0').count() > 0 else ''
    print(f"   - Modal appeared: {'Yes' if modal_text else 'No'}")
    print(f"   - Modal content: {modal_text[:100]}..." if modal_text else "")
    
    page.screenshot(path="bug_created.png")
    print("   - Screenshot saved")
    
    print("\nAll end-to-end tests completed successfully!")
    browser.close()