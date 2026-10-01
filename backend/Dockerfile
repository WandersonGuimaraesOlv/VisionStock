# opencv-python-headless e zxing-cpp têm wheels prontos para Linux (x86_64 e ARM64):
# não é preciso instalar bibliotecas de sistema nem compilador.
FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Roda sem root; a pasta temporária de vídeos pertence ao usuário da aplicação
RUN useradd --create-home --uid 10001 almox && mkdir -p /app/temp_processamento && chown -R almox /app/temp_processamento
USER almox

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
