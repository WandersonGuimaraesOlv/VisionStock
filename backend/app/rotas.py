"""Rotas HTTP do backend de drone."""
import asyncio
import os
import time
import uuid

from fastapi import APIRouter, File, HTTPException, Security, UploadFile
from starlette.concurrency import run_in_threadpool

from .config import config
from .seguranca import verificar_api_key
from .visao import processar_video

router = APIRouter()
_fila_processamento = asyncio.Semaphore(config.MAX_PROCESSAMENTOS)


@router.get("/")
@router.get("/api/health")
async def health_check():
    return {"status": "online", "servico": "Backend Drone VisionStock"}


@router.post("/api/processar-drone")
async def processar_video_drone(
    file: UploadFile = File(...),
    _api_key: str = Security(verificar_api_key),
):
    tempo_inicio = time.time()

    # Whitelisting de extensões
    _, extensao = os.path.splitext(file.filename or "")
    extensao = extensao.lower()
    if extensao not in config.EXTENSOES_PERMITIDAS:
        raise HTTPException(status_code=400, detail="Formato de arquivo não permitido. Apenas .mp4, .mov e .avi são aceitos.")

    limite_bytes = config.LIMITE_UPLOAD_MB * 1024 * 1024
    mensagem_limite = f"Arquivo excede o limite permitido de {config.LIMITE_UPLOAD_MB}MB."
    if file.size and file.size > limite_bytes:
        raise HTTPException(status_code=413, detail=mensagem_limite)

    os.makedirs(config.PASTA_TEMP, exist_ok=True)
    # Nome aleatório: evita path traversal com o nome enviado pelo cliente
    temp_filename = os.path.join(config.PASTA_TEMP, f"temp_{uuid.uuid4()}{extensao}")

    try:
        tamanho_acumulado = 0
        with open(temp_filename, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                tamanho_acumulado += len(chunk)
                if tamanho_acumulado > limite_bytes:
                    raise HTTPException(status_code=413, detail=mensagem_limite)
                buffer.write(chunk)

        # OpenCV é síncrono e pesado: roda fora do event loop para o /api/health continuar respondendo
        async with _fila_processamento:
            codigos, duracao_video = await run_in_threadpool(processar_video, temp_filename)
    finally:
        # LGPD: o vídeo nunca fica no disco depois do processamento
        try:
            if os.path.exists(temp_filename):
                os.remove(temp_filename)
        except OSError as e:
            print(f"[Limpeza] Erro ao remover arquivo temporário {temp_filename}: {e}")

    return {
        "sucesso": True,
        "total_encontrados": len(codigos),
        "codigos": sorted(codigos),
        "tempo_processamento": round(time.time() - tempo_inicio, 2),
        "duracao_video": round(duracao_video, 2),
    }
