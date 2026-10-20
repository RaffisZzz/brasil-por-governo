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
    destino = BRUTO / "series"
    destino.mkdir(parents=True, exist_ok=True)
    hoje = pd.Timestamp.today().normalize()
    for nome, cfg in INDICADORES.items():
        if "derivado" in cfg:
            continue
        lo, hi = cfg["faixa"]
        if nome == "pib":
            datas = pd.date_range(cfg["desde"], hoje, freq="YS")
            valores = rng.normal(3, 3, len(datas)).clip(lo, hi)
        elif cfg["frequencia"] == "anual":  # indicadores sociais: só até o ano passado, como os reais
            datas = pd.date_range(cfg["desde"], hoje - pd.DateOffset(years=1), freq="YS")
            valores = passeio(len(datas), (lo + hi) / 2, (hi - lo) / 40, lo, hi, rng)
        else:
            datas = pd.date_range(cfg["desde"], hoje, freq="MS")
            ini = {"ipca": 1.0, "dolar": 1.0, "salario_minimo": 70, "reservas": 20_000, "poder_compra": 12}.get(nome, (lo + hi) / 2)
            passo = {"ipca": 0.3, "dolar": 0.08, "salario_minimo": 6, "reservas": 2_000}.get(nome, (hi - lo) / 40)
            valores = passeio(len(datas), ini, passo, lo, hi, rng)
            if nome == "salario_minimo":
                valores = np.maximum.accumulate(valores)
        pd.DataFrame({"data": datas.date, "valor": valores.round(4)}).to_parquet(destino / f"{nome}.parquet", index=False)
    MARCA_AMOSTRA.write_text("dados gerados por scripts/gerar_amostra.py\n")
    print(f"Amostra sintética gravada em {destino}")


if __name__ == "__main__":
    main()
