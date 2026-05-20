from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import bugs, analytics, integrations, auth, admin
from app.api.routes.audit import router as audit_router
from app.api.routes.notifications import router as notifications_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await init_db()
    logger.info("Database initialized")

    from app.core.events import event_bus
    from app.subscribers.notification_subscriber import (
        on_bug_assigned,
        on_bug_status_changed,
        on_bug_deleted,
        on_sync_bug_updated,
    )
    from app.core import event_names
    event_bus.subscribe(event_names.BUG_ASSIGNED, on_bug_assigned)
    event_bus.subscribe(event_names.BUG_STATUS_CHANGED, on_bug_status_changed)
    event_bus.subscribe(event_names.BUG_DELETED, on_bug_deleted)
    event_bus.subscribe(event_names.SYNC_BUG_UPDATED, on_sync_bug_updated)
    logger.info("Event subscribers registered")
    
    try:
        from app.services.sync_service import _sync_service
        from app.core.config import settings
        if settings.SYNC_ENABLED and settings.SYNC_INTERVAL_MINUTES > 0:
            result = await _sync_service.start_scheduler()
            logger.info(f"Sync scheduler started: {result}")
    except Exception as e:
        logger.warning(f"Sync scheduler not started: {e}")
    
    yield
    
    try:
        from app.services.sync_service import _sync_service
        await _sync_service.stop_scheduler()
    except Exception:
        pass
    
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bugs.router, prefix="/api/bugs", tags=["bugs"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(
    integrations.router, prefix="/api/integrations", tags=["integrations"]
)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(admin.router, tags=["admin"])
app.include_router(audit_router)
app.include_router(notifications_router)

try:
    from app.api.routes.uploads import router as uploads_router
    app.include_router(uploads_router, prefix="/api", tags=["uploads"])
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
except Exception:
    pass

try:
    from app.api.routes import sync as sync_router
    app.include_router(sync_router.router)
except Exception:
    pass


@app.get("/")
async def root():
    return {
        "message": "AI Bug Triage & Root Cause Analyzer API",
        "version": settings.VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}
