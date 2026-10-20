"""Roda as consultas de sql/exportacao/ e grava:
- site/data/*.json para o site estático
- data/powerbi/*.csv para o Power BI Desktop
"""
import json
from datetime import date

import duckdb

from config import BRUTO, DADOS, INDICADORES, MARCA_AMOSTRA, RAIZ, SITE_DADOS, WAREHOUSE


def gravar_json(nome: str, conteudo) -> None:
    (SITE_DADOS / f"{nome}.json").write_text(
        json.dumps(conteudo, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")


def main() -> None:
    SITE_DADOS.mkdir(parents=True, exist_ok=True)
    pasta_pbi = DADOS / "powerbi"
    pasta_pbi.mkdir(parents=True, exist_ok=True)

    with duckdb.connect(str(WAREHOUSE), read_only=True) as con:
        tabelas = {}
        for arquivo in sorted((RAIZ / "sql" / "exportacao").glob("*.sql")):
            df = con.sql(arquivo.read_text(encoding="utf-8")).df()
            df.to_csv(pasta_pbi / f"{arquivo.stem}.csv", index=False, sep=";", decimal=",")
            tabelas[arquivo.stem] = df
            print(f"{arquivo.stem}: {len(df):,} linhas")

    # Séries em formato compacto: {indicador: [[mês, valor, governo, mês do mandato], ...]}
    series = {
        ind: grupo[["mes", "valor", "governo_id", "mes_mandato"]].astype(object)
                .where(grupo[["mes", "valor", "governo_id", "mes_mandato"]].notna(), None).values.tolist()
        for ind, grupo in tabelas["series"].groupby("indicador")
    }
    metricas = tabelas["metricas"].astype(object).where(tabelas["metricas"].notna(), None)

    # Fotos da Wikipédia (etl/fotos.py); ausentes na amostra sintética ou se a API falhar.
    arq_fotos = BRUTO / "fotos.json"
    fotos = json.loads(arq_fotos.read_text(encoding="utf-8")) if arq_fotos.exists() else {}
    governos = [{**g, **fotos.get(g["id"], {})} for g in tabelas["governos"].to_dict(orient="records")]
    gravar_json("governos", governos)
    gravar_json("acontecimentos", tabelas["acontecimentos"].to_dict(orient="records"))
    gravar_json("polemicas", tabelas["polemicas"].to_dict(orient="records"))
    gravar_json("metricas", metricas.to_dict(orient="records"))
    gravar_json("series", series)
    gravar_json("pib", tabelas["pib"].astype(object).where(tabelas["pib"].notna(), None).values.tolist())
    # Fontes opcionais que falharam ficam fora do site.
    presentes = {k: cfg for k, cfg in INDICADORES.items()
                 if not cfg.get("opcional") or (BRUTO / "series" / f"{k}.parquet").exists()}
    gravar_json("indicadores", {k: {c: v for c, v in cfg.items() if c != "faixa"} for k, cfg in presentes.items()})
    gravar_json("meta", {"gerado_em": date.today().isoformat(), "amostra_sintetica": MARCA_AMOSTRA.exists()})


if __name__ == "__main__":
    main()
