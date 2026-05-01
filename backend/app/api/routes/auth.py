from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt

from app.core.database import get_db, User
from app.core.config import settings

router = APIRouter()
security = HTTPBearer(auto_error=False)

# ============================================================================
# Pydantic Models
# ============================================================================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


# ============================================================================
# Password Hashing
# ============================================================================

def hash_password(password: str) -> str:
    """Hash password using PBKDF2 with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${pwd_hash.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    try:
        salt, pwd_hash_hex = hashed.split('$')
        pwd_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return secrets.compare_digest(pwd_hash.hex(), pwd_hash_hex)
    except Exception:
        return False


# ============================================================================
# JWT Token Management
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        if user_id is None:
            return None
        return TokenData(user_id=int(user_id), email=email)
    except Exception:
        return None


# ============================================================================
# Auth Endpoints
# ============================================================================

@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    password_hash = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=password_hash,
        full_name=user_data.full_name
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Create token
    access_token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email
    })
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            is_active=new_user.is_active,
            is_admin=new_user.is_admin,
            created_at=new_user.created_at
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password"""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # Create token
    access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email
    })
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at
    )


@router.post("/logout")
async def logout():
    """Logout (client should delete token)"""
    return {"message": "Logged out successfully"}


@router.patch("/me")
async def update_profile(
    data: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if data.full_name is not None:
        user.full_name = data.full_name
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at
    )


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Change password for authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    user.password_hash = hash_password(data.new_password)
    await db.commit()
    
    return {"message": "Password changed successfully"}


# ============================================================================
# Optional: Get User from Token (for dependency injection)
# ============================================================================

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        return None
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    return result.scalar_one_or_none()


# ============================================================================
# Password Reset Endpoints
# ============================================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


async def require_admin(
    user: Optional[User] = Depends(get_current_user_optional)
) -> User:
    """Require admin user"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return user


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate and send OTP for password reset"""
    from app.core.database import PasswordResetOTP
    from app.services.email_service import get_email_service
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        return {"message": "If the email exists, an OTP has been sent"}
    
    otp_code = secrets.token_hex(3)[:6]
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    existing_otp = await db.execute(
        select(PasswordResetOTP).where(
            PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.used == False
        )
    )
    old_otp = existing_otp.scalar_one_or_none()
    if old_otp:
        old_otp.used = True
        await db.commit()
    
    new_otp = PasswordResetOTP(
        user_id=user.id,
        otp=otp_code,
        expires_at=expires_at
    )
    db.add(new_otp)
    await db.commit()
    
    email_service = get_email_service()
    html_content = email_service.get_password_reset_html(otp_code, user.full_name)
    
    sent = await email_service.send_email(
        to_email=user.email,
        subject="Your Password Reset Code - Bug Triage",
        html_content=html_content
    )
    
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email. Please try again later."
        )
    
    return {"message": "If the email exists, an OTP has been sent"}


@router.post("/verify-otp")
async def verify_otp(
    data: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify OTP and return reset token"""
    from app.core.database import PasswordResetOTP
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        return {"message": "Invalid OTP"}
    
    otp_result = await db.execute(
        select(PasswordResetOTP).where(
            PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.used == False
        ).order_by(PasswordResetOTP.created_at.desc())
    )
    otp_record = otp_result.scalar_one_or_none()
    
    if not otp_record:
        return {"message": "Invalid OTP"}
    
    if otp_record.locked_until and otp_record.locked_until > datetime.utcnow():
        remaining = int((otp_record.locked_until - datetime.utcnow()).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked. Try again in {remaining} minutes."
        )
    
    if otp_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )
    
    if otp_record.attempts >= 3:
        otp_record.locked_until = datetime.utcnow() + timedelta(minutes=15)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again in 15 minutes."
        )
    
    if otp_record.otp != data.otp:
        otp_record.attempts += 1
        remaining = 3 - otp_record.attempts
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempts remaining."
        )
    
    otp_record.used = True
    await db.commit()
    
    reset_token = create_access_token(
        {"sub": str(user.id), "type": "password_reset"},
        expires_delta=timedelta(minutes=15)
    )
    
    return {"reset_token": reset_token, "message": "OTP verified successfully"}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """Reset password using reset token"""
    try:
        payload = jwt.decode(
            data.reset_token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        if payload.get("type") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        user_id = int(payload.get("sub"))
        
        if len(data.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters"
            )
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.password_hash = hash_password(data.new_password)
        await db.commit()
        
        return {"message": "Password reset successful. Please login with your new password."}
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )