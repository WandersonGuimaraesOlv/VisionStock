"""Testes do backend de drone: autenticação, validações e leitura de um vídeo sintético."""
import os

import cv2
import numpy as np
import pytest
import zxingcpp
from fastapi.testclient import TestClient

from app.config import config
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def chave(monkeypatch):
    monkeypatch.setattr(config, "API_KEY", "chave-teste")


def gerar_video(caminho, texto):
    """Cria um vídeo curto com um QR Code se deslocando (o filtro de movimento ignora frames parados)."""
    qr = zxingcpp.create_barcode(texto, zxingcpp.BarcodeFormat.QRCode).to_image(scale=8)
    qr = cv2.cvtColor(np.array(qr), cv2.COLOR_GRAY2BGR)
    h, w = qr.shape[:2]
    escritor = cv2.VideoWriter(caminho, cv2.VideoWriter_fourcc(*"mp4v"), 15, (640, 480))
    for i in range(30):
        frame = np.full((480, 640, 3), 255, dtype=np.uint8)
        x = 20 + i * 5
        frame[40:40 + h, x:x + w] = qr
        escritor.write(frame)
    escritor.release()


def test_health():
    assert client.get("/api/health").json()["status"] == "online"


def test_recusa_sem_chave():
    r = client.post("/api/processar-drone", files={"file": ("a.mp4", b"x", "video/mp4")})
    assert r.status_code == 403


def test_recusa_extensao():
    r = client.post("/api/processar-drone", headers={"X-API-KEY": "chave-teste"},
                    files={"file": ("a.exe", b"x", "application/octet-stream")})
    assert r.status_code == 400


def test_sem_api_key_configurada(monkeypatch):
    monkeypatch.setattr(config, "API_KEY", "")
    r = client.post("/api/processar-drone", headers={"X-API-KEY": "x"},
                    files={"file": ("a.mp4", b"x", "video/mp4")})
    assert r.status_code == 503


def test_le_qr_do_video(tmp_path):
    caminho = os.path.join(tmp_path, "drone.mp4")
    gerar_video(caminho, "MAT:000123;LOTE:9")
    with open(caminho, "rb") as f:
        r = client.post("/api/processar-drone", headers={"X-API-KEY": "chave-teste"},
                        files={"file": ("drone.mp4", f, "video/mp4")})
    assert r.status_code == 200
    dados = r.json()
    assert "MAT:000123;LOTE:9" in dados["codigos"]
    assert dados["total_encontrados"] >= 1
    # LGPD: nenhum vídeo fica no disco
    assert not [n for n in os.listdir(config.PASTA_TEMP) if n.startswith("temp_")]
