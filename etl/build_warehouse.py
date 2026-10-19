"""Cria o warehouse DuckDB a partir das tabelas curadas pelo PySpark."""
import duckdb

from config import CURADO, RAIZ, WAREHOUSE


def main() -> None:
    sql = (RAIZ / "sql" / "schema.sql").read_text(encoding="utf-8").replace("{curado}", CURADO.as_posix())
    WAREHOUSE.unlink(missing_ok=True)
    with duckdb.connect(str(WAREHOUSE)) as con:
        con.execute(sql)
        for tabela in ["dim_governo", "fato_mensal", "fato_pib", "fato_acontecimento", "fato_polemica", "metricas_governo"]:
            n = con.execute(f"SELECT count(*) FROM {tabela}").fetchone()[0]
            print(f"{tabela}: {n:,} linhas")


if __name__ == "__main__":
    main()
