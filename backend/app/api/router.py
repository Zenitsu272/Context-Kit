from fastapi import APIRouter

from app.api.routes import auth, context_packages, health, workspaces

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(workspaces.router, tags=["workspaces"])
api_router.include_router(context_packages.router, prefix="/api/context-packages", tags=["context-packages"])
