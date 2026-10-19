"""Busca na Wikipédia em português a foto de cada presidente (coluna "wikipedia" de
dados/governos.csv) e grava data/raw/fotos.json: {id: {"foto": url, "pagina": url}}.

As imagens ficam hospedadas na Wikimedia; o site só aponta para elas. Se a API não
responder, o pipeline segue sem fotos e o site mostra as iniciais no lugar.
"""
import csv
import json
import urllib.parse
import urllib.request

from config import BRUTO, GOVERNOS_CSV

API = "https://pt.wikipedia.org/w/api.php"
CABECALHOS = {"User-Agent": "BrasilPorGoverno/1.0 (https://github.com/RaffisZzz/raio-x-saude--munic-pios-)"}


def miniaturas(titulos: list[str]) -> dict[str, str]:
    """Título pedido -> URL da miniatura (segue redirecionamentos da Wikipédia)."""
    params = {"action": "query", "format": "json", "formatversion": "2", "prop": "pageimages",
              "piprop": "thumbnail", "pithumbsize": "320", "redirects": "1", "titles": "|".join(titulos)}
    req = urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers=CABECALHOS)
    with urllib.request.urlopen(req, timeout=60) as r:
        q = json.loads(r.read())["query"]
    # A API devolve o título final; refazemos o caminho pedido -> normalizado -> redirecionado.
    passo = {n["from"]: n["to"] for n in q.get("normalized", []) + q.get("redirects", [])}
    fotos = {p["title"]: p["thumbnail"]["source"] for p in q["pages"] if "thumbnail" in p}
    saida = {}
    for t in titulos:
        final = t
        while final in passo:
            final = passo[final]
        if final in fotos:
            saida[t] = fotos[final]
    return saida


def main() -> None:
    governos = list(csv.DictReader(open(GOVERNOS_CSV, encoding="utf-8")))
    titulos = sorted({g["wikipedia"] for g in governos if g["wikipedia"]})
    try:
        achadas = miniaturas(titulos)
    except Exception as e:  # sem fotos não é motivo para derrubar o pipeline
        print(f"Aviso: não foi possível buscar as fotos ({e!r}); o site usará as iniciais.")
        achadas = {}
    fotos = {
        g["id"]: {"foto": achadas[g["wikipedia"]],
                  "pagina": "https://pt.wikipedia.org/wiki/" + urllib.parse.quote(g["wikipedia"].replace(" ", "_"))}
        for g in governos if g["wikipedia"] in achadas
    }
    BRUTO.mkdir(parents=True, exist_ok=True)
    (BRUTO / "fotos.json").write_text(json.dumps(fotos, ensure_ascii=False, indent=1), encoding="utf-8")
    faltando = [g["id"] for g in governos if g["id"] not in fotos]
    print(f"Fotos: {len(fotos)} de {len(governos)} governos" + (f"; sem foto: {', '.join(faltando)}" if faltando else ""))


if __name__ == "__main__":
    main()
