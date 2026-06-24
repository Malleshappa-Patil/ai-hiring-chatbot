"""
Password hashing and verification using bcrypt directly.
Uses the bcrypt library directly for Python 3.12+ compatibility
(passlib has issues with newer bcrypt versions).
"""
import bcrypt


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False
