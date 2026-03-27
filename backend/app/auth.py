"""
app/auth.py
API key authentication dependency for all routes.

Usage
-----
Applied globally in main.py via FastAPI's app-level dependencies.
Every request must include the header:

    X-API-Key: <value of DASHBOARD_API_KEY in .env>

Returns 401 if the header is missing or incorrect.
"""

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    if api_key != settings.DASHBOARD_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
