"""Configuração do backend lida de variáveis de ambiente."""
import os


def _lista(valor: str) -> list[str]:
    return [item.strip() for item in valor.split(",") if item.strip()]


class Config:
    # Chave exigida no header X-API-KEY. Sem ela o processamento fica bloqueado.
    API_KEY: str = os.environ.get("API_KEY", "").strip()
    # Origens liberadas no CORS. Vazio = só mesmo domínio (via Nginx), que não precisa de CORS.
    CORS_ORIGINS: list[str] = _lista(os.environ.get("CORS_ORIGINS", ""))
    LIMITE_UPLOAD_MB: int = int(os.environ.get("LIMITE_UPLOAD_MB", "600"))
    # Quantos vídeos podem ser processados ao mesmo tempo (OpenCV usa muita CPU)
    MAX_PROCESSAMENTOS: int = int(os.environ.get("MAX_PROCESSAMENTOS", "1"))
    FPS_AMOSTRAGEM: int = int(os.environ.get("FPS_AMOSTRAGEM", "3"))
    PASTA_TEMP: str = os.environ.get(
        "PASTA_TEMP", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp_processamento")
    )
    EXTENSOES_PERMITIDAS = {".mp4", ".mov", ".avi"}


config = Config()
