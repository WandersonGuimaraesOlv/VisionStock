import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def cria_cliente(tmp_path, monkeypatch):
    """Cria um cliente com banco novo; modo = 'observar' ou 'bloquear'."""
    from fastapi.testclient import TestClient

    def fabrica(modo="bloquear"):
        monkeypatch.setenv("ACESSO_BANCO", str(tmp_path / "acesso.db"))
        monkeypatch.setenv("ACESSO_MODO", modo)
        import app.config
        importlib.reload(app.config)
        for nome in ("app.banco", "app.seguranca", "app.rotas", "app.main"):
            importlib.reload(sys.modules[nome]) if nome in sys.modules else importlib.import_module(nome)
        from app import banco
        from app.main import app as aplicacao
        from app.seguranca import gerar_hash_senha

        banco.iniciar()
        with banco.conexao() as con:
            banco.criar_usuario(con, "admin", "Administrador", gerar_hash_senha("segredo1"), True, [])
        return TestClient(aplicacao, base_url="http://teste")

    return fabrica
