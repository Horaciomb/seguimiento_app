from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from .config import settings
from .database import check_connection
from .routers import alertas, llamadas, supervisores

app = FastAPI(
    title="Seguimiento de Indicadores API",
    description="Seguimiento de llamadas a afiliadores marcados por los indicadores de control (Lab 001)",
    version="0.1.0",
    default_response_class=ORJSONResponse,
)

# Sin auth a propósito (decisión de diseño): uso interno, un solo usuario. Ver CLAUDE.md.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alertas.router)
app.include_router(llamadas.router)
app.include_router(supervisores.router)


@app.get("/health", tags=["sistema"])
def health_check():
    db_ok = check_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "conectado" if db_ok else "sin conexión",
        "version": app.version,
    }


@app.get("/", tags=["sistema"])
def root():
    return {"mensaje": "Seguimiento de Indicadores API activa", "docs": "/docs"}
