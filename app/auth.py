import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
from app.database import users_collection
from bson import ObjectId
import os

# Require SECRET_KEY to be set in environment - fail fast on startup if missing
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError(
        "CRITICAL: SECRET_KEY environment variable is required for JWT signing. "
        "Set a secure 32+ character value in your .env file or deployment environment."
    )
if len(SECRET_KEY) < 32:
    raise ValueError("CRITICAL: SECRET_KEY must be at least 32 characters long for security.")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject: str = str(payload.get("sub") or "").strip()
        if not subject:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # New tokens use user_id in sub. Fallback to legacy email tokens.
    if "@" in subject:
        user = await users_collection.find_one({"email": subject.lower()})
        if not user:
            raise credentials_exception
        return str(user["_id"])
    return subject

async def get_current_admin(current_user_id: str = Depends(get_current_user)):
    user_id = current_user_id
    if "@" in user_id:
        user = await users_collection.find_one({"email": user_id.lower()})
    else:
        try:
            oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
            user = await users_collection.find_one({"_id": oid})
        except:
             user = await users_collection.find_one({"email": user_id.lower()})

    if not user or not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user
