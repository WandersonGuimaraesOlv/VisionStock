"""Fábrica da aplicação FastAPI."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import config
from .rotas import router


def criar_app() -> FastAPI:
    app = FastAPI(title="VisionStock — Backend de Drone")

    if config.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=config.CORS_ORIGINS,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["X-API-KEY", "Content-Type"],
        )

    if not config.API_KEY:
        print("[Config] ATENÇÃO: API_KEY não definida; /api/processar-drone vai recusar requisições.")

    app.include_router(router)
    return app


app = criar_app()
