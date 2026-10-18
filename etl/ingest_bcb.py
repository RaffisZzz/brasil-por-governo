"""Baixa as séries do catálogo (config.INDICADORES) na API do SGS do Banco Central.

A API rejeita consultas longas com uma página "Requisição inválida", então tudo
é baixado em janelas de um ano. Cada série vira data/raw/sgs/<indicador>.parquet.
"""
import json
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

import pandas as pd

from config import BRUTO, INDICADORES

URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{sgs}/dados?formato=json&dataInicial={ini}&dataFinal={fim}"
# O firewall da API recusa alguns clientes com a página "Requisição inválida". Testamos
# cabeçalhos diferentes e ficamos com o primeiro que funcionar.
VARIANTES_CABECALHOS = [
    {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0 Safari/537.36", "Accept": "application/json, text/plain, */*",
     "Accept-Language": "pt-BR,pt;q=0.9"},
    {"User-Agent": "curl/8.5.0", "Accept": "*/*"},
    {},
]
CABECALHOS = VARIANTES_CABECALHOS[0]


def baixar_janela(sgs: int, ini: date, fim: date) -> list[dict]:
    url = URL.format(sgs=sgs, ini=ini.strftime("%d/%m/%Y"), fim=fim.strftime("%d/%m/%Y"))
    global CABECALHOS
    for tentativa in range(5):
        corpo = b""
        if tentativa:  # depois de uma falha, troca o conjunto de cabeçalhos
            CABECALHOS = VARIANTES_CABECALHOS[tentativa % len(VARIANTES_CABECALHOS)]
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=CABECALHOS), timeout=90) as r:
                corpo = r.read()
                return json.loads(corpo)
        except urllib.error.HTTPError as e:
            if e.code == 404:  # janela sem dados
                return []
            erro = f"HTTP {e.code}: {e.read()[:300]!r}"
        except (urllib.error.URLError, TimeoutError) as e:
            erro = repr(e)
        except json.JSONDecodeError:
            # A API às vezes responde com uma página HTML de erro em vez de JSON.
            erro = f"resposta não é JSON: {corpo[:300]!r}"
        print(f"  tentativa {tentativa + 1} falhou ({erro}); tentando de novo", flush=True)
        time.sleep(3 * 2 ** tentativa)
    raise RuntimeError(f"SGS {sgs}: falhou em {ini}–{fim}: {erro}")


def baixar_serie(sgs: int, desde: str) -> pd.DataFrame:
    inicio = date.fromisoformat(desde)
    hoje = date.today()
    linhas = []
    while inicio <= hoje:
        fim = min(date(inicio.year, 12, 31), hoje)
        linhas += baixar_janela(sgs, inicio, fim)
        inicio = fim + timedelta(days=1)
        time.sleep(0.3)  # gentileza com a API
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
