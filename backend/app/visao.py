"""Visão computacional: leitura de códigos de barras / QR em frames de vídeo (OpenCV + ZXing-C++)."""
import re

import cv2
import numpy as np
import zxingcpp

from .config import config

# Sanitização: remove caracteres perigosos sem quebrar os delimitadores usados nas etiquetas
def sanitizar_codigo(texto):
    if not texto:
        return ""
    # Permite letras, números, espaços, parênteses, separadores comuns de etiquetas (, ; : . - _ / | =).
    # Qualquer outro caractere (aspas, < >, crase, etc.) é removido.
    return re.sub(r'[^a-zA-Z0-9\s\(\),;:\.\-_/|=]', '', texto)

def decodificar_frame(frame):
    """Aplica os filtros de imagem e lê todos os códigos presentes no frame via ZXing de forma progressiva (Early Exit)."""
    codigos_do_frame = []
    try:
        # Otimização: Limita o tamanho máximo do frame para reduzir pixels a processar
        altura, largura = frame.shape[:2]
        max_dim = 1024
        if max(altura, largura) > max_dim:
            escala = max_dim / max(altura, largura)
            nova_largura = int(largura * escala)
            nova_altura = int(altura * escala)
            frame = cv2.resize(frame, (nova_largura, nova_altura), interpolation=cv2.INTER_AREA)

        frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 1. Tenta decodificar a imagem original em escala de cinza (mais rápido)
        try:
            resultados = zxingcpp.read_barcodes(frame_gray)
            for r in resultados:
                if r.valid and r.text:
                    texto_sanitizado = sanitizar_codigo(r.text.strip())
                    if texto_sanitizado and texto_sanitizado not in codigos_do_frame:
                        codigos_do_frame.append(texto_sanitizado)
        except Exception:
            pass

        # Early Exit: se já encontrou códigos, pula a geração de filtros pesados
        if codigos_do_frame:
            return codigos_do_frame

        # 2. Tenta com Threshold Adaptativo (excelente para curvas e sombras)
        try:
            adaptativo = cv2.adaptiveThreshold(
                frame_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
            )
            resultados = zxingcpp.read_barcodes(adaptativo)
            for r in resultados:
                if r.valid and r.text:
                    texto_sanitizado = sanitizar_codigo(r.text.strip())
                    if texto_sanitizado and texto_sanitizado not in codigos_do_frame:
                        codigos_do_frame.append(texto_sanitizado)
        except Exception:
            pass

        if codigos_do_frame:
            return codigos_do_frame

        # 3. Tenta com CLAHE (Contraste)
        try:
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            contraste = clahe.apply(frame_gray)
            resultados = zxingcpp.read_barcodes(contraste)
            for r in resultados:
                if r.valid and r.text:
                    texto_sanitizado = sanitizar_codigo(r.text.strip())
                    if texto_sanitizado and texto_sanitizado not in codigos_do_frame:
                        codigos_do_frame.append(texto_sanitizado)
                        
            if codigos_do_frame:
                return codigos_do_frame

            # 4. Tenta com Otsu sobre o CLAHE
            _, otsu = cv2.threshold(contraste, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            resultados = zxingcpp.read_barcodes(otsu)
            for r in resultados:
                if r.valid and r.text:
                    texto_sanitizado = sanitizar_codigo(r.text.strip())
                    if texto_sanitizado and texto_sanitizado not in codigos_do_frame:
                        codigos_do_frame.append(texto_sanitizado)
        except Exception:
            pass

    except Exception as e:
        print(f"[ZXing Error] Erro ao processar frame: {e}")
        
    return codigos_do_frame



def processar_video(caminho: str) -> tuple[set[str], float]:
    """Percorre o vídeo amostrando frames e devolve (códigos encontrados, duração em segundos)."""
    cap = cv2.VideoCapture(caminho)
    try:
        fps_video = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
        duracao_video = total_frames / fps_video if fps_video > 0 else 0.0

        codigos_encontrados: set[str] = set()
        frames_para_pular = max(1, int(fps_video / config.FPS_AMOSTRAGEM))
        frame_anterior_cinza = None

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Filtro de movimento: pula frames quase idênticos ao anterior (< 0,5% de variação)
            frame_cinza = cv2.cvtColor(cv2.resize(frame, (256, 256)), cv2.COLOR_BGR2GRAY)
            processar = True
            if frame_anterior_cinza is not None:
                mean_diff = np.mean(cv2.absdiff(frame_cinza, frame_anterior_cinza)) / 255.0
                if mean_diff < 0.005:
                    processar = False
            frame_anterior_cinza = frame_cinza

            if processar:
                codigos_encontrados.update(decodificar_frame(frame))

            # Pula frames intermediários com cap.grab() (não decodifica a imagem)
            for _ in range(frames_para_pular - 1):
                if not cap.grab():
                    break
    finally:
        cap.release()

    return codigos_encontrados, duracao_video
