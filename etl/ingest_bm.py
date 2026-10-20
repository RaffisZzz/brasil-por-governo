"""Baixa as séries do Banco Mundial do catálogo (config.INDICADORES): indicadores sociais anuais do Brasil.

Cada série vira data/raw/series/<indicador>.parquet com as colunas data (1º de janeiro do ano) e valor,
no mesmo formato das séries do Ipeadata.
"""
import json
import time
import urllib.error
import urllib.request
from datetime import date

import pandas as pd

from config import INDICADORES
from ingest_ipea import conferir_e_gravar

URL = "https://api.worldbank.org/v2/country/BRA/indicator/{codigo}?format=json&per_page=200"


def baixar_serie(codigo: str) -> pd.DataFrame:
    url = URL.format(codigo=codigo)
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "brasil-por-governo/1.0"}),
                                        timeout=60) as r:
                linhas = json.loads(r.read())[1] or []
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, IndexError) as e:
            erro = repr(e)
            print(f"  {codigo}: tentativa {tentativa + 1} falhou ({erro}); tentando de novo", flush=True)
            time.sleep(3 * 2 ** tentativa)
    else:
        raise RuntimeError(f"{codigo}: não foi possível baixar ({erro})")
    df = pd.DataFrame({"data": [date(int(l["date"]), 1, 1) for l in linhas],
                       "valor": pd.to_numeric([l["value"] for l in linhas], errors="coerce")})
    return df.dropna().sort_values("data")


def main() -> None:
    problemas = []
    for nome, cfg in INDICADORES.items():
        if "bm" not in cfg:
            continue
        df = baixar_serie(cfg["bm"])
        if cfg.get("complemento"):  # taxa de alfabetização -> taxa de analfabetismo
            df["valor"] = 100 - df["valor"]
        problemas.append(conferir_e_gravar(nome, cfg, cfg["bm"], df))
    problemas = [p for p in problemas if p]
    if problemas:
        raise SystemExit("Séries suspeitas, confira os códigos do Banco Mundial:\n  " + "\n  ".join(problemas))


if __name__ == "__main__":
    main()
