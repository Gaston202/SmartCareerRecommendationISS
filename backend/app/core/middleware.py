from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import time
import logging

logger = logging.getLogger(__name__)


async def add_process_time_header(request: Request, call_next: Callable) -> Response:
    """Middleware to add X-Process-Time header to responses."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


async def logging_middleware(request: Request, call_next: Callable) -> Response:
    """Middleware to log all requests and responses."""
    logger.info(f"Request: {request.method} {request.url.path}")
    
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    logger.info(
        f"Response: {request.method} {request.url.path} "
        f"status={response.status_code} "
        f"time={process_time:.3f}s"
    )
    
    return response


class ExceptionHandler:
    """Centralized exception handling for FastAPI."""
    
    @staticmethod
    async def http_exception_handler(request: Request, exc) -> JSONResponse:
        """Handle HTTP exceptions."""
        from fastapi import status
        logger.error(f"HTTP Exception: {exc.detail} path={request.url.path}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": exc.detail,
                "path": request.url.path,
                "status": exc.status_code,
            },
        )
    
    @staticmethod
    async def validation_exception_handler(request: Request, exc) -> JSONResponse:
        """Handle validation exceptions."""
        from fastapi import status
        logger.error(f"Validation Exception: {exc.errors()} path={request.url.path}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": "Validation error",
                "details": exc.errors(),
                "path": request.url.path,
                "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
            },
        )
    
    @staticmethod
    async def general_exception_handler(request: Request, exc) -> JSONResponse:
        """Handle all other exceptions."""
        from fastapi import status
        logger.exception(f"Unhandled Exception: {str(exc)} path={request.url.path}")
        
        # Don't expose internal errors in production
        import os
        is_prod = os.getenv("NODE_ENV") == "production"
        error_detail = "Internal server error" if is_prod else str(exc)
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": error_detail,
                "path": request.url.path,
                "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )