"""Roda o pipeline completo, etapa por etapa.

    python run_pipeline.py              # dados reais (Ipeadata e Banco Mundial)
    python run_pipeline.py --amostra    # dados sintéticos, sem internet (só para testar)
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
BRUTO = RAIZ / "data" / "raw"

ETAPAS_COMUNS = ["etl/transform_spark.py", "etl/build_warehouse.py", "etl/export_site.py"]


def rodar(script: str) -> None:
    print(f"\n=== {script} ===", flush=True)
    subprocess.run([sys.executable, str(RAIZ / script)], check=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--amostra", action="store_true", help="usa dados sintéticos")
    args = p.parse_args()
    shutil.rmtree(BRUTO, ignore_errors=True)  # amostra e dados reais nunca se misturam
    coleta = ["scripts/gerar_amostra.py"] if args.amostra else ["etl/ingest_ipea.py", "etl/ingest_bm.py", "etl/ingest_dieese.py", "etl/fotos.py"]
    etapas = coleta + ETAPAS_COMUNS
    for script in etapas:
        rodar(script)


if __name__ == "__main__":
    main()
