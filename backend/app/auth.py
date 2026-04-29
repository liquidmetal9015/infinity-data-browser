import firebase_admin
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_session
from app.models.user import User

# Initialize Firebase Admin App implicitly with default credentials,
# or explicit config if needed by the hosting environment.
# Since we might be running locally without credentials initially,
# we wrap it to prevent crash on startup if credentials are not configured yet.
try:
    firebase_admin.get_app()
except ValueError:
    try:
        firebase_admin.initialize_app()
    except Exception as e:
        print(f"Warning: Firebase Admin initialization failed: {e}")

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_session),
) -> User:
    """Verifies the Firebase token and returns the current User."""
    token = credentials.credentials
    try:
        # In a real async backend, we might want to run this blocking call in a threadpool.
        # But for typical payloads, it's fast enough.
        decoded_token = auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=401, detail=f"Invalid authentication token: {str(e)}"
        ) from e

    uid = decoded_token.get("uid")
    email = decoded_token.get("email")
    if not uid or not email:
        raise HTTPException(status_code=401, detail="Token missing required fields")

    # Auto-provision user if they don't exist
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalars().first()

    if not user:
        user = User(id=uid, email=email)
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()
            raise HTTPException(
                status_code=500, detail="Could not provision user"
            ) from None

    return user


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    """Fast-path dependency that just extracts the UID without hitting the database."""
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        if not uid:
            raise ValueError("No UID in token")
        return uid
    except Exception as e:
        raise HTTPException(
            status_code=401, detail=f"Invalid authentication token: {str(e)}"
        ) from e
