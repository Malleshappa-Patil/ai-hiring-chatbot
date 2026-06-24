"""Authentication endpoints: register, login, refresh, me."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.session import get_db
from backend.database.models import User
from backend.auth.password import hash_password, verify_password
from backend.auth.jwt_handler import create_access_token, create_refresh_token, decode_token
from backend.models.request_models import LoginRequest, RegisterRequest
from backend.models.response_models import TokenResponse, UserResponse
from backend.api.dependencies import get_current_user

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check existing user
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return {
        "access_token": create_access_token({"sub": user.id, "role": user.role}),
        "refresh_token": create_refresh_token({"sub": user.id}),
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "access_token": create_access_token({"sub": user.id, "role": user.role}),
        "refresh_token": create_refresh_token({"sub": user.id}),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
