"""Baixa do DIEESE o salário mínimo nominal e o salário mínimo necessário, mês a mês, desde o Plano Real.

O "necessário" é quanto uma família de quatro pessoas precisaria para cobrir alimentação, moradia,
saúde, educação, transporte e outras despesas básicas; o DIEESE o calcula a partir do preço da cesta
básica mais cara entre as capitais. A série gravada é a razão entre os dois, em %.

O DIEESE não tem API: a página traz uma tabela HTML, lida aqui com expressões regulares. Se a página
mudar ou não responder, o indicador fica de fora e o resto do pipeline segue.
"""
import html
import re
import urllib.request
from datetime import date

import pandas as pd

from config import BRUTO, INDICADORES
from ingest_ipea import conferir_e_gravar

URL = "https://www.dieese.org.br/analisecestabasica/salarioMinimo.html"
MESES = {m: i for i, m in enumerate(["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
                                     "setembro", "outubro", "novembro", "dezembro"], start=1)}


def reais(texto: str) -> float | None:
    m = re.search(r"([\d.]+,\d{2})", texto)
    return float(m.group(1).replace(".", "").replace(",", ".")) if m else None


def ler_tabela(pagina: str) -> pd.DataFrame:
    linhas, ano = [], None
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", pagina, flags=re.S | re.I):
        celulas = [html.unescape(re.sub(r"<[^>]+>", " ", c)).strip()
                   for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S | re.I)]
        if not celulas:
            continue
        primeira = " ".join(celulas[0].split()).lower()
        if re.fullmatch(r"\d{4}", primeira):
            ano = int(primeira)
        elif ano and primeira in MESES and len(celulas) >= 3:
            nominal, necessario = reais(celulas[1]), reais(celulas[2])
            if nominal and necessario:
                linhas.append({"data": date(ano, MESES[primeira], 1), "valor": 100 * nominal / necessario})
    return pd.DataFrame(linhas, columns=["data", "valor"]).drop_duplicates("data").sort_values("data")


def main() -> None:
    nome = "poder_compra"
    cfg = INDICADORES[nome]
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "brasil-por-governo/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            pagina = r.read().decode("iso-8859-1")
        df = ler_tabela(pagina)
    except Exception as e:  # noqa: BLE001 - fonte opcional: qualquer falha deixa o indicador de fora
        print(f"{nome}: DIEESE indisponível ({e!r}); o indicador fica de fora desta vez")
        return
    aviso = conferir_e_gravar(nome, cfg, "DIEESE", df) if len(df) else "nenhuma linha lida"
    if aviso:  # tabela mudou de formato: melhor não publicar números errados
        (BRUTO / "series" / f"{nome}.parquet").unlink(missing_ok=True)
        print(f"{nome}: {aviso}; o indicador fica de fora desta vez")


if __name__ == "__main__":
    main()
