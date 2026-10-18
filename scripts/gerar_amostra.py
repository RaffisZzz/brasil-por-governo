"""Gera séries SINTÉTICAS no mesmo formato da ingestão real, para testar o pipeline
sem internet. Os valores são aleatórios e o site mostra um aviso quando usa esta amostra.
O deploy do GitHub Pages sempre usa os dados reais.

Uso: python scripts/gerar_amostra.py
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl"))
from config import BRUTO, INDICADORES, MARCA_AMOSTRA  # noqa: E402


def passeio(n: int, ini: float, passo: float, lo: float, hi: float, rng) -> np.ndarray:
    v = [ini]
    for _ in range(n - 1):
        v.append(float(np.clip(v[-1] + rng.normal(0, passo), lo, hi)))
    return np.array(v)


def main() -> None:
    rng = np.random.default_rng(7)
    destino = BRUTO / "sgs"
    destino.mkdir(parents=True, exist_ok=True)
    hoje = pd.Timestamp.today().normalize()
    for nome, cfg in INDICADORES.items():
        lo, hi = cfg["faixa"]
        if cfg["frequencia"] == "diaria":
            datas = pd.bdate_range(cfg["desde"], hoje)
            valores = passeio(len(datas), 1.0, 0.012, 0.8, 6.5, rng)
        elif cfg["frequencia"] == "anual":
            datas = pd.date_range(cfg["desde"], hoje, freq="YS")
            valores = rng.normal(3, 3, len(datas)).clip(lo, hi)
        else:
            datas = pd.date_range(cfg["desde"], hoje, freq="MS")
            ini = {"ipca": 1.0, "ipca_12m": 12, "salario_minimo": 70, "reservas": 20_000}.get(nome, (lo + hi) / 2)
            passo = {"ipca": 0.3, "ipca_12m": 1.0, "salario_minimo": 6, "reservas": 2_000}.get(nome, (hi - lo) / 40)
            valores = passeio(len(datas), ini, passo, lo, hi, rng)
            if nome == "salario_minimo":
                valores = np.maximum.accumulate(valores)
        pd.DataFrame({"data": datas.date, "valor": valores.round(4)}).to_parquet(destino / f"{nome}.parquet", index=False)
    MARCA_AMOSTRA.write_text("dados gerados por scripts/gerar_amostra.py\n")
    print(f"Amostra sintética gravada em {destino}")


if __name__ == "__main__":
    main()
