# Context Kit Backend

Phase 2 and Phase 3 backend for Context Kit.

## Included

- FastAPI app bootstrap
- environment-driven configuration
- SQLAlchemy database setup
- local-dev auth session flow
- health endpoint
- context package CRUD/import endpoints
- basic audit logging for auth and package mutations
- workspace creation, membership, and local-dev invite routes
- package version history and restore endpoints
- search and filter query support for package discovery
- SQLite-by-default local development path
- Postgres-ready connection configuration

## Local Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
copy .env.example .env
uvicorn app.main:app --reload
```

Open:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

## Extension Sign-In

From Context Kit:

- API Base URL: `http://127.0.0.1:8000`
- Email: any value for local development
- Name: optional

## Notes

- Local development defaults to SQLite at `backend/context_kit.db`
- Set `DATABASE_URL` to a Postgres connection string when you are ready to move off SQLite
- Production auth, migrations, embedding-backed semantic search, and stronger compliance controls are still the next backend milestones
