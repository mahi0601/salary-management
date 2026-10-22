import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Engine

from app.database import Base, create_db_engine, create_session_factory, database_url
from app.errors import DomainError
from app.routers import employees, insights, meta


def create_app(engine: Engine | None = None) -> FastAPI:
    engine = engine or create_db_engine(database_url())
    Base.metadata.create_all(engine)

    app = FastAPI(title="Salary Management API")
    app.state.session_factory = create_session_factory(engine)

    @app.exception_handler(DomainError)
    def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(employees.router)
    app.include_router(meta.router)
    app.include_router(insights.router)
    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    """Serve the built React app from the same origin when present (single-container deploy)."""
    static_dir = Path(os.environ.get("SALARY_STATIC_DIR", "static"))
    index = static_dir / "index.html"
    if not index.is_file():
        return
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        candidate = (static_dir / path).resolve()
        if path and candidate.is_file() and static_dir.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)

