from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    print("1. Testing Login page...")
    page.goto("http://localhost:5173/login")
    page.wait_for_load_state("networkidle")
    
    # Check for email and password inputs
    email_input = page.locator('input[name="email"]').count()
    password_input = page.locator('input[name="password"]').count()
    submit_btn = page.locator('button[type="submit"]').count()
    
    print(f"   - Email input: {'OK' if email_input else 'MISSING'}")
    print(f"   - Password input: {'OK' if password_input else 'MISSING'}")
    print(f"   - Submit button: {'OK' if submit_btn else 'MISSING'}")
    
    print("2. Testing Register page...")
    page.goto("http://localhost:5173/register")
    page.wait_for_load_state("networkidle")
    
    # Check for form elements
    name_input = page.locator('input[name="fullName"]').count()
    email_input = page.locator('input[name="email"]').count()
    password_input = page.locator('input[name="password"]').count()
    confirm_input = page.locator('input[name="confirmPassword"]').count()
    submit_btn = page.locator('button[type="submit"]').count()
    
    print(f"   - Name input: {'OK' if name_input else 'MISSING'}")
    print(f"   - Email input: {'OK' if email_input else 'MISSING'}")
    print(f"   - Password input: {'OK' if password_input else 'MISSING'}")
    print(f"   - Confirm password: {'OK' if confirm_input else 'MISSING'}")
    print(f"   - Submit button: {'OK' if submit_btn else 'MISSING'}")
    
    print("3. Testing Header Auth buttons...")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    
    # Check for login and register links in header
    login_link = page.locator('a:has-text("Login")').count()
    register_link = page.locator('a:has-text("Register")').count()
    
    print(f"   - Login button in header: {'OK' if login_link else 'MISSING'}")
    print(f"   - Register button in header: {'OK' if register_link else 'MISSING'}")
    
    print("4. Testing Protected Route...")
    page.goto("http://localhost:5173/bugs/new")
    page.wait_for_load_state("networkidle")
    
    # Should redirect to login
    current_url = page.url
    redirected = "/login" in current_url
    
    print(f"   - Redirected to login: {'OK' if redirected else 'FAILED (at ' + current_url + ')'}")
    
    # Save screenshot
    page.screenshot(path="auth_test.png")
    print("   - Screenshot saved to auth_test.png")
    
    print("\nAll tests completed!")
    browser.close()