from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    
    print("Opening bug form...")
    page.goto("http://localhost:5173/bugs/new")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Fill form fields
    page.fill('input[name="title"]', 'Test Attachment Filename')
    page.fill('textarea[name="description"]', 'Testing filename extension')
    page.select_option('select[name="priority"]', 'high')
    page.select_option('select[name="severity"]', 'high')
    page.fill('textarea[name="repro_steps"]', '1. Upload\n2. Submit')
    page.fill('textarea[name="expected_result"]', 'Check filename')
    page.fill('textarea[name="actual_result"]', 'Testing')
    
    # Upload attachment
    page.set_input_files('input[type="file"]', '4d77198f-aaf5-420c-846c-95067b918b57.png')
    time.sleep(1)
    
    # Check push to Azure
    page.check('input[name="pushToAzure"]')
    time.sleep(1)
    
    # Submit
    page.locator('button:has-text("Submit")').first.click()
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    
    # Get screenshot of result
    page.screenshot(path="tests/e2e/assets/frontend_result.png")
    print("Result screenshot saved")
    
    browser.close()