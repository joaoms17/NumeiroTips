#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper das convocatórias do Mundial 2026 (artigo FIFA) → CSV.

Gera `convocados_mundial_2026.csv` com as colunas:  numero,jogador,selecao

IMPORTANTE — correr LOCALMENTE (no teu PC):
    A FIFA bloqueia (HTTP 403) pedidos de servidores de datacenter / CI, por
    isso isto NÃO corre em ambientes cloud. Num PC normal funciona.

Instalação (uma vez):
    pip install playwright beautifulsoup4 lxml
    playwright install chromium

Uso:
    python scrape_convocados.py
    # opcional: passar outro URL
    python scrape_convocados.py "https://www.fifa.com/pt/articles/..."

A página carrega conteúdo dinamicamente → usa Playwright para renderizar.
Se a extração vier vazia/curta, abre `convocados_debug.html` (gravado por este
script) para veres a estrutura real e ajustar os seletores em extrair_jogadores().
"""

import csv
import re
import sys
import unicodedata

URL_DEFAULT = "https://www.fifa.com/pt/articles/copa-mundo-2026-listas-convocados-todas-selecoes"
OUT_CSV = "convocados_mundial_2026.csv"
DEBUG_HTML = "convocados_debug.html"

# Seleções possíveis (nomes PT como aparecem em fifa.com/pt). Servem de âncora
# para detetar o início de cada bloco. É uma lista larga — se faltar alguma
# seleção na página, acrescenta-a aqui.
NACOES = [
    "Portugal", "Espanha", "França", "Inglaterra", "Brasil", "Argentina",
    "Alemanha", "Países Baixos", "Holanda", "Bélgica", "Croácia", "Itália",
    "Uruguai", "Colômbia", "México", "Estados Unidos", "Canadá", "Marrocos",
    "Senegal", "Japão", "Coreia do Sul", "Coreia do Norte", "Austrália",
    "Equador", "Costa do Marfim", "Gana", "Nigéria", "Egito", "Argélia",
    "Tunísia", "Camarões", "Mali", "Suíça", "Dinamarca", "Suécia", "Noruega",
    "Áustria", "Polónia", "Sérvia", "Escócia", "País de Gales", "Turquia",
    "Ucrânia", "Hungria", "Grécia", "Roménia", "Chéquia", "República Checa",
    "Eslováquia", "Eslovénia", "Paraguai", "Peru", "Chile", "Venezuela",
    "Bolívia", "Arábia Saudita", "Irão", "Irã", "Iraque", "Jordânia", "Catar",
    "Emirados Árabes Unidos", "Uzbequistão", "Nova Zelândia", "Panamá",
    "Costa Rica", "Honduras", "Jamaica", "Haiti", "Cabo Verde", "África do Sul",
    "RD Congo", "República Democrática do Congo", "Curaçao", "Angola",
]

# Palavras que NÃO são nomes de jogadores (cabeçalhos de posição, etc.).
NAO_JOGADOR = {
    "guarda-redes", "guarda redes", "defesas", "defesa", "medios", "médios",
    "medio", "médio", "meio-campo", "meio campo", "avancados", "avançados",
    "avancado", "avançado", "atacantes", "atacante", "treinador", "selecionador",
    "guardioes", "guardiões", "laterais", "centrais", "extremos", "pontas",
}


def normalizar(s: str) -> str:
    """minúsculas, sem acentos, espaços colapsados — para comparar."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


NACOES_NORM = {normalizar(n): n for n in NACOES}


def obter_html(url: str) -> str:
    """Renderiza a página com Playwright (aceita cookies, faz scroll) e devolve o HTML."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            locale="pt-PT",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1366, "height": 900},
        )
        page = ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Aceitar cookies (OneTrust, comum na FIFA)
        for sel in ("#onetrust-accept-btn-handler", "button:has-text('Aceitar')",
                    "button:has-text('Accept')"):
            try:
                page.click(sel, timeout=3000)
                break
            except Exception:
                pass

        # Scroll para carregar conteúdo lazy
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        for _ in range(12):
            page.mouse.wheel(0, 2000)
            page.wait_for_timeout(400)
        page.wait_for_timeout(1500)

        html = page.content()
        browser.close()
        return html


def parse_jogador(texto: str):
    """De uma linha de texto, devolve (numero, nome) ou None se não for jogador."""
    texto = re.sub(r"\s+", " ", texto).strip(" \t·•—-").strip()
    if not texto or len(texto) > 60:
        return None
    if normalizar(texto) in NAO_JOGADOR or normalizar(texto) in NACOES_NORM:
        return None

    # "7 Nome", "7. Nome", "7) Nome", "7 - Nome"
    m = re.match(r"^(\d{1,2})\s*[.)\-–]?\s+(.+)$", texto)
    if m:
        return m.group(1), m.group(2).strip()

    # "Nome (7)", "Nome 7", "Nome - 7"
    m = re.match(r"^(.+?)\s*[\(\[\-–]?\s*(\d{1,2})\s*[\)\]]?$", texto)
    if m and re.search(r"[A-Za-zÀ-ÿ]", m.group(1)):
        return m.group(2), m.group(1).strip(" \t·•—-").strip()

    # Sem número — aceitar se parecer um nome (tem letras e não é cabeçalho)
    if re.search(r"[A-Za-zÀ-ÿ]", texto):
        return "", texto

    return None


def extrair_jogadores(html: str):
    """
    Percorre o DOM por ordem: cada cabeçalho que seja uma seleção abre um bloco;
    os itens seguintes (li/td/p curtos) são tentados como jogadores.
    Devolve lista de tuplos (numero, jogador, selecao).
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")

    # remover ruído
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()

    selecao_atual = None
    resultados = []
    vistos = set()  # (selecao, nome) para evitar duplicados

    # Tags candidatas, por ordem de aparência no documento
    candidatas = soup.find_all(["h1", "h2", "h3", "h4", "h5", "li", "td", "p", "strong"])
    for el in candidatas:
        # texto só deste elemento (evita apanhar filhos repetidos: ignora se tem
        # sub-listas/sub-tabelas dentro)
        if el.name in ("li", "td") and el.find(["li", "td", "ul", "ol", "table"]):
            continue
        txt = el.get_text(" ", strip=True)
        if not txt:
            continue

        nnorm = normalizar(txt)

        # É uma seleção? (cabeçalho que abre bloco)
        if nnorm in NACOES_NORM:
            selecao_atual = NACOES_NORM[nnorm]
            continue
        # Às vezes a seleção vem como "Portugal (Grupo X)" num heading
        if el.name in ("h1", "h2", "h3", "h4", "h5", "strong"):
            for nk, nv in NACOES_NORM.items():
                if nnorm.startswith(nk + " ") or nnorm == nk:
                    selecao_atual = nv
                    break

        if not selecao_atual:
            continue
        if el.name not in ("li", "td", "p"):
            continue

        pj = parse_jogador(txt)
        if not pj:
            continue
        numero, nome = pj
        chave = (selecao_atual, normalizar(nome))
        if chave in vistos:
            continue
        vistos.add(chave)
        resultados.append((numero, nome, selecao_atual))

    return resultados


def gravar_csv(linhas, caminho=OUT_CSV):
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["numero", "jogador", "selecao"])
        for numero, jogador, selecao in linhas:
            w.writerow([numero, jogador, selecao])


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else URL_DEFAULT
    print(f"A abrir: {url}")
    html = obter_html(url)
    with open(DEBUG_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML renderizado gravado em {DEBUG_HTML} ({len(html)} bytes)")

    linhas = extrair_jogadores(html)
    gravar_csv(linhas)

    selecoes = sorted({s for _, _, s in linhas})
    print(f"\nCSV gravado: {OUT_CSV}")
    print(f"Seleções extraídas: {len(selecoes)}")
    print(f"Jogadores extraídos: {len(linhas)}")
    if selecoes:
        from collections import Counter
        cont = Counter(s for _, _, s in linhas)
        print("\nJogadores por seleção:")
        for s in selecoes:
            print(f"  {s}: {cont[s]}")
    if not linhas:
        print(
            "\n⚠️  Nada extraído. A estrutura da página deve ser diferente do "
            f"esperado — abre {DEBUG_HTML} e ajusta extrair_jogadores()."
        )


if __name__ == "__main__":
    main()
