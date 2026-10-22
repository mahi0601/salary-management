import pytest
from fastapi.testclient import TestClient

from app.database import create_db_engine
from app.main import create_app


@pytest.fixture
def spa_client(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path.parent / "secret.txt").write_text("top secret")
    monkeypatch.setenv("SALARY_STATIC_DIR", str(tmp_path))
    return TestClient(create_app(create_db_engine("sqlite:///:memory:")))


def test_serves_index_at_root(spa_client):
    assert spa_client.get("/").text == "<html>app</html>"


def test_serves_built_assets(spa_client):
    assert spa_client.get("/assets/app.js").text == "console.log(1)"


def test_unknown_paths_fall_back_to_index_for_client_side_routing(spa_client):
    assert spa_client.get("/insights").text == "<html>app</html>"


def test_api_routes_are_not_shadowed_by_the_fallback(spa_client):
    assert spa_client.get("/api/health").json() == {"status": "ok"}


def test_path_traversal_cannot_read_files_outside_static_dir(spa_client):
    response = spa_client.get("/..%2fsecret.txt")

    assert "top secret" not in response.text


def test_no_frontend_mounted_when_build_is_absent(client):
    assert client.get("/").status_code == 404
