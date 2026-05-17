from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    print("1. Logging in...")
    page.goto("http://localhost:5173/login")
    page.wait_for_load_state("networkidle")
    
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'test123')
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    print("2. Creating bug...")
    page.goto("http://localhost:5173/bugs/new")
    page.wait_for_load_state("networkidle")
    
    # Fill form
    page.fill('input[name="title"]', 'Test Bug - Verify User Email')
    page.fill('textarea[name="description"]', 'This bug is created to verify that the user email is correctly passed to the backend when creating a bug report.')
    page.fill('textarea[name="repro_steps"]', '1. Login to the app\n2. Go to New Bug page\n3. Fill form and submit')
    
    print("3. Submitting bug...")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    
    # Take screenshot
    page.screenshot(path="bug_creation_test.png")
    
    # Check if modal appeared
    page_content = page.content()
    if 'success' in page_content.lower() or 'created' in page_content.lower():
        print("4. Bug created successfully!")
    else:
        print("4. Checking page state...")
    
    # Check local storage for user data
    user_data = page.evaluate('() => localStorage.getItem("auth_user")')
    if user_data:
        print(f"   - User in localStorage: {user_data[:50]}...")
    
    print("\nTest completed!")
    browser.close()