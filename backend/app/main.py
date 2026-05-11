from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.logging import setup_logging
from app.core.middleware import (
    ExceptionHandler,
    add_process_time_header,
    logging_middleware,
)
import logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Smart Career Recommendation System - FastAPI Backend",
    version="1.0.0",
)

# CORS — never combine allow_origins=["*"] with allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging and timing middleware
app.middleware("http")(add_process_time_header)
app.middleware("http")(logging_middleware)

# Centralised exception handlers
app.add_exception_handler(StarletteHTTPException, ExceptionHandler.http_exception_handler)
app.add_exception_handler(RequestValidationError, ExceptionHandler.validation_exception_handler)
app.add_exception_handler(Exception, ExceptionHandler.general_exception_handler)

# Include API routers (MVC structure via api/v1/router.py)
app.include_router(api_router, prefix=settings.api_v1_prefix)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
    }

@app.on_event("startup")
async def startup_event():
    """Startup event."""
    logger.info(f"Starting {settings.app_name}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"API v1 prefix: {settings.api_v1_prefix}")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event."""
    logger.info("Shutting down application")
    from app.core.ai_orchestrator import _ai_orchestrator_singleton
    if _ai_orchestrator_singleton is not None and hasattr(_ai_orchestrator_singleton, "client"):
        await _ai_orchestrator_singleton.client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )