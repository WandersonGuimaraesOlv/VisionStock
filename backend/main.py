# Ponto de entrada do backend de drone (mantido para compatibilidade: uvicorn main:app).
# O código fica no pacote app/: config.py, seguranca.py, visao.py, rotas.py.
import os

from app.main import app

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
