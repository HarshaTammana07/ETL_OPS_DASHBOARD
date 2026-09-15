from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.sqlite import ensure_sample_db
from app.db.notifications import ensure_notifications_table
from app.routes import chat, dataquality, failures, health, kpis, notifications, pipelines, runs, trends


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_sample_db()
    ensure_notifications_table()
    yield


app = FastAPI(
    title="ETL Operations Center API",
    description="Read-only API for BHG ETL health dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(kpis.router)
app.include_router(trends.router)
app.include_router(pipelines.router)
app.include_router(failures.router)
app.include_router(dataquality.router)
app.include_router(runs.router)
app.include_router(notifications.router)
app.include_router(chat.router)
