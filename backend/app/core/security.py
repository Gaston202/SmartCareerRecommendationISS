from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# auto_error=True: FastAPI returns 403 automatically when no credentials are provided,
# consistent with core/dependencies.py which also uses auto_error=True (the default).
security_scheme = HTTPBearer(auto_error=True)


def require_bearer(credentials: HTTPAuthorizationCredentials) -> str:
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return credentials.credentials
