"""Autenticação por API Key (header X-API-KEY)."""
import secrets

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from .config import config

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)


async def verificar_api_key(api_key: str = Security(api_key_header)) -> str:
    if not config.API_KEY:
        raise HTTPException(status_code=503, detail="Servidor sem API_KEY configurada.")
    if not api_key or not secrets.compare_digest(api_key, config.API_KEY):
        raise HTTPException(status_code=403, detail="Acesso negado: API Key inválida.")
    return api_key
