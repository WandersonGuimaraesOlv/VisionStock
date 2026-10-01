"""Leitura dos crachás cadastrados no Supabase (tabela usada pelo login do VisionStock)."""
import json
import re
import urllib.request

from .config import config

CRACHA = re.compile(r"^[A-Za-z0-9._@-]{1,60}$")
POR_PAGINA = 1000


class ErroCrachas(Exception):
    pass


def buscar_crachas() -> list[tuple[str, str]]:
    """Retorna [(crachá, nome)] lendo a API REST do Supabase, de 1000 em 1000."""
    if not config.SUPABASE_URL or not config.SUPABASE_CHAVE:
        raise ErroCrachas("Supabase não configurado (ACESSO_SUPABASE_URL e ACESSO_SUPABASE_CHAVE).")
    resultado, inicio = [], 0
    while True:
        pedido = urllib.request.Request(
            f"{config.SUPABASE_URL}/rest/v1/{config.TABELA_CRACHAS}?select=id,nome_completo&order=id",
            headers={
                "apikey": config.SUPABASE_CHAVE,
                "Authorization": f"Bearer {config.SUPABASE_CHAVE}",
                "Range-Unit": "items",
                "Range": f"{inicio}-{inicio + POR_PAGINA - 1}",
            },
        )
        try:
            with urllib.request.urlopen(pedido, timeout=20) as resposta:
                pagina = json.load(resposta)
        except Exception as erro:  # rede, chave errada, tabela inexistente
            raise ErroCrachas(f"Não foi possível ler os crachás do Supabase: {erro}") from erro
        for linha in pagina:
            cracha = str(linha.get("id") or "").strip()
            if CRACHA.match(cracha):
                resultado.append((cracha, (linha.get("nome_completo") or "").strip()[:120]))
        if len(pagina) < POR_PAGINA:
            return resultado
        inicio += POR_PAGINA
