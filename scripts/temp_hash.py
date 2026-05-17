import hashlib
import secrets
import sys

password = sys.argv[1] if len(sys.argv) > 1 else "admin123"
salt = secrets.token_hex(16)
h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
print(f"{salt}${h.hex()}")