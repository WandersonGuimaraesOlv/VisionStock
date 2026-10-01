"""Aplicação FastAPI do Portal de Acesso."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from . import banco
from .config import config
from .rotas import router


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    banco.iniciar()
    yield


app = FastAPI(title="Portal de Acesso", docs_url=None, redoc_url=None, openapi_url=None, lifespan=ciclo_de_vida)
app.include_router(router)


@app.get(config.BASE, include_in_schema=False)
def sem_barra():
    return RedirectResponse(config.BASE + "/")
