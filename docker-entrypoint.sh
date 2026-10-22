#!/bin/sh
set -e
# Seeds 10,000 synthetic employees on first start only (no-op if data exists).
python -m app.seed --if-empty
exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port "${PORT:-8000}"
