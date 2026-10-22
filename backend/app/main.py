import os
import secrets
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.database import Base, create_db_engine, create_session_factory, database_url
from app import auth
from app.deps import current_user
from app.errors import DomainError
from app.models import User
from app.routers import audit, employees, insights, meta
from app.routers import auth as auth_router


def create_app(
    engine: Engine | None = None,
    *,
    jwt_secret: str | None = None,
    hr_user: tuple[str, str] | None = None,
) -> FastAPI:
    engine = engine or create_db_engine(database_url())
    Base.metadata.create_all(engine)

    app = FastAPI(title="Salary Management API")
    app.state.session_factory = create_session_factory(engine)
    # no secret configured (local dev): a random one, so tokens die with the process
    app.state.jwt_secret = jwt_secret or os.environ.get("SALARY_JWT_SECRET") or secrets.token_hex(32)
    if len(app.state.jwt_secret) < 32:
        raise RuntimeError("SALARY_JWT_SECRET must be at least 32 characters")
    hr_user = hr_user or _hr_user_from_env()
    if hr_user:
        with app.state.session_factory() as session:
            _ensure_user(session, *hr_user)

    @app.exception_handler(DomainError)
    def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    # everything except health and login needs a signed-in user
    signed_in = [Depends(current_user)]
    app.include_router(auth_router.router)
    app.include_router(employees.router, dependencies=signed_in)
    app.include_router(meta.router, dependencies=signed_in)
    app.include_router(insights.router, dependencies=signed_in)
    app.include_router(audit.router, dependencies=signed_in)
    _mount_frontend(app)
    return app


def _hr_user_from_env() -> tuple[str, str] | None:
    email, password = os.environ.get("SALARY_HR_EMAIL"), os.environ.get("SALARY_HR_PASSWORD")
    return (email, password) if email and password else None


def _ensure_user(session: Session, email: str, password: str) -> None:
    email = email.strip().lower()
    user = session.scalar(select(User).where(User.email == email))
    if user is None:
        session.add(User(email=email, password_hash=auth.hash_password(password)))
    elif not auth.verify_password(password, user.password_hash):
        user.password_hash = auth.hash_password(password)  # password changed in the env
    session.commit()


def _mount_frontend(app: FastAPI) -> None:
    # In the Docker image the React build sits next to the API; serve it from here.
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
        # a missing /something.ico should 404, not come back as the app shell
        if Path(path).suffix:
            raise HTTPException(status_code=404)
        return FileResponse(index)

