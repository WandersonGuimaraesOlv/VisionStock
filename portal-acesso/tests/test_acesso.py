from app.rotas import volta_segura

H = {"X-Portal": "1"}


def entrar(cliente, usuario="admin", senha="segredo1", volta=""):
    return cliente.post("/acesso/api/entrar", json={"usuario": usuario, "senha": senha, "volta": volta}, headers=H)


def cria_operador(cliente, sistemas):
    r = cliente.post(
        "/acesso/api/usuarios",
        json={"usuario": "joao", "nome": "João", "senha": "senha123", "sistemas": sistemas},
        headers=H,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_sem_login_bloqueia_com_401(cria_cliente):
    c = cria_cliente("bloquear")
    assert c.get("/acesso/api/verificar/rateios").status_code == 401


def test_modo_observar_libera_mas_registra(cria_cliente):
    c = cria_cliente("observar")
    assert c.get("/acesso/api/verificar/rateios", headers={"X-Original-URI": "/rateios/"}).status_code == 200
    assert entrar(c).status_code == 200
    eventos = c.get("/acesso/api/eventos").json()
    assert any(e["tipo"] == "seria_negado" and "rateios" in e["detalhe"] for e in eventos)


def test_login_errado_e_trava(cria_cliente):
    c = cria_cliente()
    for _ in range(5):
        assert entrar(c, senha="errada").status_code == 401
    assert entrar(c).status_code == 429


def test_login_exige_cabecalho_do_portal(cria_cliente):
    c = cria_cliente()
    r = c.post("/acesso/api/entrar", json={"usuario": "admin", "senha": "segredo1"})
    assert r.status_code == 403


def test_permissao_por_sistema(cria_cliente):
    c = cria_cliente()
    assert entrar(c).status_code == 200
    operador = cria_operador(c, ["visionstock"])
    # Admin vê tudo
    assert c.get("/acesso/api/verificar/rateios").status_code == 200

    c.post("/acesso/api/sair", headers=H)
    assert entrar(c, "JOAO", "senha123").status_code == 200  # login sem diferenciar maiúsculas
    assert c.get("/acesso/api/verificar/visionstock").status_code == 200
    assert c.post("/acesso/api/verificar/visionstock").status_code == 200  # Nginx repete o método original
    assert c.get("/acesso/api/verificar/rateios").status_code == 403
    assert c.get("/acesso/api/verificar/inexistente").status_code == 403
    assert c.get("/acesso/api/usuarios").status_code == 403  # não é admin
    eu = c.get("/acesso/api/eu").json()
    assert [s["slug"] for s in eu["sistemas"]] == ["visionstock"]
    assert operador["sistemas"] == ["visionstock"]


def test_desativar_derruba_a_sessao(cria_cliente):
    c = cria_cliente()
    entrar(c)
    operador = cria_operador(c, ["rateios"])
    admin_cookie = c.cookies.get("portal_sessao")

    c.cookies.clear()
    entrar(c, "joao", "senha123")
    assert c.get("/acesso/api/verificar/rateios").status_code == 200
    joao_cookie = c.cookies.get("portal_sessao")

    c.cookies.set("portal_sessao", admin_cookie)
    assert c.put(f"/acesso/api/usuarios/{operador['id']}", json={"ativo": False}, headers=H).status_code == 200

    c.cookies.set("portal_sessao", joao_cookie)
    assert c.get("/acesso/api/verificar/rateios").status_code == 401
    assert entrar(c, "joao", "senha123").status_code == 401


def test_nao_remove_o_ultimo_admin(cria_cliente):
    c = cria_cliente()
    entrar(c)
    eu_id = c.get("/acesso/api/usuarios").json()["usuarios"][0]["id"]
    r = c.put(f"/acesso/api/usuarios/{eu_id}", json={"admin": False}, headers=H)
    assert r.status_code == 400
    assert c.delete(f"/acesso/api/usuarios/{eu_id}", headers=H).status_code == 400


def test_sistemas_crud_e_permissao_some_ao_remover(cria_cliente):
    c = cria_cliente()
    entrar(c)
    r = c.post("/acesso/api/sistemas", json={"slug": "compras", "nome": "Compras", "caminho": "compras"}, headers=H)
    assert r.status_code == 200
    assert any(s["caminho"] == "/compras/" for s in r.json())
    operador = cria_operador(c, ["compras", "nao-existe"])
    assert operador["sistemas"] == ["compras"]
    assert c.delete("/acesso/api/sistemas/compras", headers=H).status_code == 200
    usuarios = c.get("/acesso/api/usuarios").json()["usuarios"]
    assert next(u for u in usuarios if u["usuario"] == "joao")["sistemas"] == []
    r = c.post("/acesso/api/sistemas", json={"slug": "X Y", "nome": "a", "caminho": "/a/"}, headers=H)
    assert r.status_code == 400


def test_troca_de_senha(cria_cliente):
    c = cria_cliente()
    entrar(c)
    assert c.post("/acesso/api/minha-senha", json={"atual": "x", "nova": "novasenha"}, headers=H).status_code == 400
    assert c.post("/acesso/api/minha-senha", json={"atual": "segredo1", "nova": "novasenha"}, headers=H).status_code == 200
    c.cookies.clear()
    assert entrar(c, senha="novasenha").status_code == 200


def test_cookie_e_volta(cria_cliente):
    c = cria_cliente()
    r = entrar(c, volta="/rateios/?a=1&b=2")
    assert r.json()["volta"] == "/rateios/?a=1&b=2"
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "path=/" in cookie and "samesite=lax" in cookie
    assert entrar(c, volta="https://outro.site/").json()["volta"] == "/"


def test_volta_segura():
    assert volta_segura("//malicioso.com") == "/"
    assert volta_segura("/\\malicioso.com") == "/"
    assert volta_segura("/acesso/entrar?volta=/x") == "/"
    assert volta_segura("/visionstock/") == "/visionstock/"


def test_paginas(cria_cliente):
    c = cria_cliente()
    for caminho in ("/acesso/", "/acesso/entrar", "/acesso/sem-acesso", "/acesso/portal.js", "/acesso/estilo.css"):
        assert c.get(caminho).status_code == 200, caminho
    assert c.get("/acesso/main.py").status_code == 404
    assert c.get("/acesso/api/health").json()["status"] == "online"


def test_importar_crachas_e_primeiro_acesso(cria_cliente, monkeypatch):
    c = cria_cliente()
    import app.rotas
    monkeypatch.setattr(app.rotas, "buscar_crachas", lambda: [("1234", "Ana Lima"), ("5678", ""), ("admin", "x")])
    entrar(c)
    r = c.post("/acesso/api/importar-crachas", json={"sistemas": ["visionstock"]}, headers=H)
    assert r.json() == {"novos": 2, "existentes": 1}
    usuarios = {u["usuario"]: u for u in c.get("/acesso/api/usuarios").json()["usuarios"]}
    assert usuarios["1234"]["senha_pendente"] and usuarios["1234"]["sistemas"] == ["visionstock"]
    assert usuarios["5678"]["nome"] == "Crachá 5678"
    assert not usuarios["admin"]["senha_pendente"]
    # Rodar de novo não duplica
    assert c.post("/acesso/api/importar-crachas", json={}, headers=H).json() == {"novos": 0, "existentes": 3}

    c.cookies.clear()
    r = entrar(c, "1234", "")
    assert r.status_code == 409 and r.json()["criar_senha"] is True
    assert c.get("/acesso/api/verificar/visionstock").status_code == 401
    r = c.post("/acesso/api/primeiro-acesso", json={"usuario": "1234", "senha": "abc", "volta": "/visionstock/"}, headers=H)
    assert r.status_code == 400  # senha curta
    r = c.post("/acesso/api/primeiro-acesso", json={"usuario": "1234", "senha": "minha123", "volta": "/visionstock/"}, headers=H)
    assert r.status_code == 200 and r.json()["volta"] == "/visionstock/"
    assert c.get("/acesso/api/verificar/visionstock").status_code == 200
    # Depois de criada, ninguém sobrescreve pelo primeiro acesso
    c.cookies.clear()
    r = c.post("/acesso/api/primeiro-acesso", json={"usuario": "1234", "senha": "outra123"}, headers=H)
    assert r.status_code == 400
    assert entrar(c, "1234", "minha123").status_code == 200


def test_admin_zera_senha_e_pessoa_cria_outra(cria_cliente):
    c = cria_cliente()
    entrar(c)
    operador = cria_operador(c, ["rateios"])
    r = c.put(f"/acesso/api/usuarios/{operador['id']}", json={"senha": ""}, headers=H)
    assert r.json()["senha_pendente"] is True
    c.cookies.clear()
    assert entrar(c, "joao", "senha123").status_code == 409
    novo = c.post("/acesso/api/usuarios", json={"usuario": "sem", "nome": "Sem Senha"}, headers=H)
    assert novo.status_code == 401  # sem login de admin


def test_importar_sem_supabase_configurado(cria_cliente):
    c = cria_cliente()
    entrar(c)
    r = c.post("/acesso/api/importar-crachas", json={}, headers=H)
    assert r.status_code == 502 and "Supabase" in r.json()["detail"]
