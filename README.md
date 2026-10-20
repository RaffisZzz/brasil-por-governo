# Brasil por Governo

Site que mostra como estava o Brasil em cada governo, do dia a dia das pessoas à economia, de Deodoro da Fonseca até hoje, e permite comparar dois governos lado a lado.

**No dia a dia:** quanto os preços subiram, salário mínimo real, renda média do trabalhador, desemprego, pobreza e extrema pobreza, acesso a saneamento básico, mortalidade infantil, expectativa de vida, homicídios e analfabetismo.

**Economia:** crescimento do PIB, dólar, taxa Selic, dívida líquida do setor público e reservas internacionais.

Cada indicador aparece a partir de quando existe medição oficial comparável (por exemplo: PIB desde 1901, mortalidade infantil e expectativa de vida desde 1960, inflação desde 1980, pobreza desde 1981, saneamento desde 2000, desemprego e renda desde 2012). Onde não há medição, o site mostra "Sem informação".

> Os indicadores descrevem o período de cada mandato. Eles não medem quanto cada presidente foi responsável pelo resultado.

## Arquitetura

```
API do Ipeadata ────────► ingest_ipea.py (Python)       data/raw/series/*.parquet
API do Banco Mundial ───► ingest_bm.py (Python)          (indicadores sociais anuais)
                                     │
dados/governos.csv ─────────► transform_spark.py (PySpark) data/curated/
                                     │  junção por intervalo de datas: cada mês e ano ganha o seu governo
                                     ▼
                              build_warehouse.py + sql/schema.sql (DuckDB)
                                     │  modelo estrela, índice de preços, salário real, métricas por mandato
                                     ▼
                              export_site.py + sql/exportacao/*.sql
                                     ├──► site/data/*.json ──► site/ (HTML, CSS, JS + ECharts) ──► GitHub Pages
                                     └──► data/powerbi/*.csv ──► Power BI Desktop
```

| Pasta | O que tem |
| --- | --- |
| `dados/governos.csv` | Linha do tempo dos governos, mantida à mão, com partido e página da Wikipédia de cada presidente |
| `etl/fotos.py` | Busca na Wikipédia a foto de cada presidente; sem resposta, o site mostra as iniciais |
| `dados/acontecimentos.csv` | Acontecimentos marcantes de cada governo (lista editorial; o pipeline confere se cada data cai dentro do mandato) |
| `dados/polemicas.csv` | Polêmicas de cada governo com o desfecho quando houve (lista editorial, mesma conferência de datas) |
| `etl/` | Coleta (Python), transformação (PySpark), warehouse e exportação |
| `sql/` | Modelo do warehouse e consultas de exportação (DuckDB) |
| `site/` | Site estático: HTML, CSS e JavaScript |
| `powerbi/` | Guia do dashboard no Power BI |
| `.github/workflows/` | Pipeline mensal e publicação no GitHub Pages |

## Rodar localmente

Requisitos: Python 3.10+ e Java 17 (para o Spark).

```bash
python -m venv .venv
source .venv/bin/activate          # no Windows: .venv\Scripts\activate
pip install -r requirements.txt

python run_pipeline.py             # baixa os dados reais e gera site/data/
python -m http.server -d site 8000 # abra http://localhost:8000
```

Sem internet, `python run_pipeline.py --amostra` gera séries sintéticas só para testar o código; o site mostra um aviso nesse caso.

## Publicação

O workflow `.github/workflows/pipeline.yml` roda a cada push na `main`, todo dia 5 e sob demanda. Ele baixa os dados, roda o pipeline e publica a pasta `site/` no GitHub Pages. Na primeira vez, ative em **Settings → Pages → Source: GitHub Actions**.

## Fontes

- Fotos dos presidentes: [Wikipédia](https://pt.wikipedia.org), hospedadas na Wikimedia Commons; cada foto tem link para a página de origem.
- [Ipeadata](http://www.ipeadata.gov.br), que republica numa API aberta as séries do Banco Central (dólar, Selic, dívida, reservas), do IBGE (PIB, IPCA, PNAD Contínua) e do Ministério do Trabalho (salário mínimo). Os códigos das séries estão em `etl/config.py`.
- [Banco Mundial](https://data.worldbank.org), que reúne os indicadores sociais anuais do Brasil: pobreza e extrema pobreza (com base nas pesquisas do IBGE), saneamento (OMS/Unicef), mortalidade infantil (ONU/IGME), expectativa de vida (ONU), homicídios (UNODC) e analfabetismo (IBGE/Unesco).
- A API do SGS do Banco Central seria a fonte direta, mas recusa conexões de servidores fora do Brasil, como os do GitHub Actions.
