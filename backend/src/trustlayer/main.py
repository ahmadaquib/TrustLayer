from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from trustlayer.api.analytics import router as analytics_router
from trustlayer.api.approvals import router as approvals_router
from trustlayer.api.chat import router as chat_router

app = FastAPI(
    title="TrustLayer API & Unified Dashboard",
    description="Dual-Grounding Policy Middleware for Agentic AI in High-Risk Financial Systems",
    version="0.1.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(chat_router)
app.include_router(approvals_router)
app.include_router(analytics_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/users")
async def get_users():
    """Returns users from the database. Only returns fields that exist in the DB: id, name, role."""
    try:
        from sqlalchemy import select
        from trustlayer.db.models import Role, User
        from trustlayer.db.session import async_session

        async with async_session() as session:
            stmt = select(User, Role.name).join(Role, User.role_id == Role.id).order_by(User.id)
            result = await session.execute(stmt)
            rows = result.all()
            if not rows:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database contains no user records. Please run database seed.",
                )
            return [
                {
                    "id": str(user.id),
                    "name": user.name,
                    "role": role_name,
                }
                for user, role_name in rows
            ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unreachable. Ensure PostgreSQL is running and seeded. Error: {str(exc)}",
        ) from exc


# Mount unified frontend distribution if built
frontend_dist = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
