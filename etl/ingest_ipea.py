"""Baixa as séries do Ipeadata do catálogo (config.INDICADORES) na API OData.

Uma requisição por série traz o histórico inteiro. Cada série vira
data/raw/series/<indicador>.parquet com as colunas data e valor.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

import pandas as pd

from config import BRUTO, INDICADORES

URL = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{codigo}')?$select=VALDATA,VALVALOR"


def baixar_serie(codigo: str) -> pd.DataFrame:
    url = URL.format(codigo=urllib.parse.quote(codigo))
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}),
                                        timeout=120) as r:
                linhas = json.loads(r.read())["value"]
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:
            erro = repr(e)
            print(f"  {codigo}: tentativa {tentativa + 1} falhou ({erro}); tentando de novo", flush=True)
            time.sleep(3 * 2 ** tentativa)
    else:
        raise RuntimeError(f"{codigo}: não foi possível baixar ({erro})")
    df = pd.DataFrame(linhas, columns=["VALDATA", "VALVALOR"])
    # VALDATA vem como "1994-07-01T00:00:00-03:00"; só a data interessa.
    df = pd.DataFrame({"data": pd.to_datetime(df["VALDATA"].str[:10]).dt.date,
                       "valor": pd.to_numeric(df["VALVALOR"], errors="coerce")})
    return df.dropna().drop_duplicates("data").sort_values("data")


def conferir_e_gravar(nome: str, cfg: dict, codigo: str, df: pd.DataFrame) -> str | None:
    """Corta o início da série, grava o Parquet e devolve um aviso se os valores parecerem errados."""
    df = df[df["data"] >= date.fromisoformat(cfg["desde"])]
    destino = BRUTO / "series"
    destino.mkdir(parents=True, exist_ok=True)
    df.to_parquet(destino / f"{nome}.parquet", index=False)
    print(f"{nome:20s} {codigo:18s} {len(df):>6,} observações, {df['data'].min()} a {df['data'].max()}", flush=True)
    lo, hi = cfg["faixa"]
    fora = (~df["valor"].between(lo, hi)).mean() if len(df) else 1.0
    if len(df) == 0 or fora > 0.2:
        return f"{nome} ({codigo}): {len(df)} linhas, {fora:.0%} fora da faixa {lo}–{hi}"
    return None


def main() -> None:
    problemas = []
    for nome, cfg in INDICADORES.items():
        if "ipea" not in cfg:  # derivada no PySpark ou de outra fonte
            continue
        df = baixar_serie(cfg["ipea"])
        if cfg.get("anualizar"):  # taxa ao mês -> taxa ao ano
            df["valor"] = 100 * ((1 + df["valor"] / 100) ** 12 - 1)
        problemas.append(conferir_e_gravar(nome, cfg, cfg["ipea"], df))
    problemas = [p for p in problemas if p]
    if problemas:
        raise SystemExit("Séries suspeitas, confira os códigos do Ipeadata:\n  " + "\n  ".join(problemas))


if __name__ == "__main__":
    main()
