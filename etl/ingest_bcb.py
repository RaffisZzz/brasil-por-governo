"""Baixa as séries do catálogo (config.INDICADORES) na API do SGS do Banco Central.

A API devolve no máximo 10 anos por consulta em séries diárias, então tudo é
baixado em janelas de 10 anos. Cada série vira data/raw/sgs/<indicador>.parquet.
"""
import json
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

import pandas as pd

from config import BRUTO, INDICADORES

URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{sgs}/dados?formato=json&dataInicial={ini}&dataFinal={fim}"
CABECALHOS = {"User-Agent": "brasil-por-governo/1.0 (projeto de portfolio)", "Accept": "application/json"}


def baixar_janela(sgs: int, ini: date, fim: date) -> list[dict]:
    url = URL.format(sgs=sgs, ini=ini.strftime("%d/%m/%Y"), fim=fim.strftime("%d/%m/%Y"))
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=CABECALHOS), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:  # janela sem dados
                return []
            erro = e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            erro = e
        time.sleep(2 ** tentativa)
    raise RuntimeError(f"SGS {sgs}: falhou em {ini}–{fim}: {erro}")


def baixar_serie(sgs: int, desde: str) -> pd.DataFrame:
    inicio = date.fromisoformat(desde)
    hoje = date.today()
    linhas = []
    while inicio <= hoje:
        fim = min(date(inicio.year + 9, 12, 31), hoje)
        linhas += baixar_janela(sgs, inicio, fim)
        inicio = fim + timedelta(days=1)
    df = pd.DataFrame(linhas)
    if df.empty:
        return pd.DataFrame(columns=["data", "valor"])
    df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y").dt.date
    df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
    return df.dropna().drop_duplicates("data").sort_values("data")


def main() -> None:
    destino = BRUTO / "sgs"
    destino.mkdir(parents=True, exist_ok=True)
    problemas = []
    for nome, cfg in INDICADORES.items():
        df = baixar_serie(cfg["sgs"], cfg["desde"])
        lo, hi = cfg["faixa"]
        fora = (~df["valor"].between(lo, hi)).mean() if len(df) else 1.0
        if len(df) == 0 or fora > 0.2:
            problemas.append(f"{nome} (SGS {cfg['sgs']}): {len(df)} linhas, {fora:.0%} fora da faixa {lo}–{hi}")
        df.to_parquet(destino / f"{nome}.parquet", index=False)
        print(f"{nome:15s} SGS {cfg['sgs']:>6}: {len(df):>6,} observações, {df['data'].min()} a {df['data'].max()}")
    if problemas:
        raise SystemExit("Séries suspeitas, confira os códigos SGS:\n  " + "\n  ".join(problemas))


if __name__ == "__main__":
    main()
