"""Confere se os links de notícia de dados/acontecimentos.csv ainda abrem.

Só avisa: link quebrado não derruba o pipeline. Sites que recusam robôs (403, 429)
aparecem na lista mas não contam como quebrados.

Uso: python scripts/conferir_links.py
"""
import csv
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parent.parent / "dados" / "acontecimentos.csv"
NAVEGADOR = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def status(url: str) -> str:
    pedido = urllib.request.Request(url, headers={"User-Agent": NAVEGADOR, "Accept-Language": "pt-BR,pt;q=0.9"})
    try:
        with urllib.request.urlopen(pedido, timeout=25) as r:
            return str(r.status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception as e:  # rede, TLS, tempo esgotado
        return type(e).__name__


def main() -> None:
    linhas = list(csv.DictReader(ARQUIVO.open(encoding="utf-8")))
    com_link = [l for l in linhas if l.get("link")]
    print(f"{len(com_link)} de {len(linhas)} acontecimentos têm link")
    with ThreadPoolExecutor(8) as ex:
        resultados = list(ex.map(lambda l: status(l["link"]), com_link))
    quebrados = 0
    for l, s in zip(com_link, resultados):
        if s.startswith("2"):
            continue
        bloqueio = s in {"401", "403", "429"}
        quebrados += not bloqueio
        nivel = "notice" if bloqueio else "warning"
        print(f"::{nivel}::{s} {l['governo_id']} {l['data']} {l['titulo']}: {l['link']}")
    print(f"{quebrados} link(s) quebrado(s)")


if __name__ == "__main__":
    main()
