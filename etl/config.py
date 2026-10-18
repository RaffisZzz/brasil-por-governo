"""Configuração central: caminhos e o catálogo de indicadores coletados no Banco Central (SGS)."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GOVERNOS_CSV = RAIZ / "dados" / "governos.csv"
DADOS = RAIZ / "data"
BRUTO = DADOS / "raw"            # séries como vieram da API, em Parquet
CURADO = DADOS / "curated"       # saída do PySpark
WAREHOUSE = DADOS / "warehouse.duckdb"
SITE_DADOS = RAIZ / "site" / "data"
MARCA_AMOSTRA = BRUTO / "AMOSTRA_SINTETICA"

# Séries do SGS (https://www3.bcb.gov.br/sgspub). "faixa" é uma checagem de sanidade:
# se a maior parte dos valores cair fora dela, o código provavelmente está errado e o
# pipeline avisa. "desde" corta períodos em que a série não é comparável.
INDICADORES = {
    "dolar": {
        "sgs": 1, "nome": "Dólar comercial (venda)", "unidade": "R$/US$",
        "frequencia": "diaria", "desde": "1994-07-01", "faixa": (0.5, 10),
        "nota": "Média mensal da cotação diária. Começa no Plano Real, quando a moeda passa a ser comparável.",
    },
    "ipca": {
        "sgs": 433, "nome": "Inflação (IPCA) no mês", "unidade": "% no mês",
        "frequencia": "mensal", "desde": "1980-01-01", "faixa": (-2, 90),
        "nota": "Variação mensal do IPCA, medido pelo IBGE.",
    },
    "ipca_12m": {
        "sgs": 13522, "nome": "Inflação (IPCA) em 12 meses", "unidade": "% em 12 meses",
        "frequencia": "mensal", "desde": "1980-01-01", "faixa": (-2, 7000),
        "nota": "IPCA acumulado nos 12 meses anteriores.",
    },
    "selic": {
        "sgs": 4189, "nome": "Taxa Selic", "unidade": "% ao ano",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (1, 70),
        "nota": "Selic acumulada no mês, anualizada. Começa no Plano Real.",
    },
    "desemprego": {
        "sgs": 24369, "nome": "Taxa de desemprego", "unidade": "%",
        "frequencia": "mensal", "desde": "2012-03-01", "faixa": (3, 20),
        "nota": "Taxa de desocupação da PNAD Contínua (IBGE), trimestre móvel. Série comparável começa em 2012.",
    },
    "divida_bruta": {
        "sgs": 13762, "nome": "Dívida bruta do governo", "unidade": "% do PIB",
        "frequencia": "mensal", "desde": "2006-12-01", "faixa": (40, 100),
        "nota": "Dívida bruta do governo geral, metodologia a partir de 2008.",
    },
    "salario_minimo": {
        "sgs": 1619, "nome": "Salário mínimo", "unidade": "R$",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (60, 5000),
        "nota": "Valor nominal. O site mostra também o valor real, corrigido pelo IPCA.",
    },
    "reservas": {
        "sgs": 3546, "nome": "Reservas internacionais", "unidade": "US$ milhões",
        "frequencia": "mensal", "desde": "1970-01-01", "faixa": (100, 500_000),
        "nota": "Reservas internacionais no conceito liquidez, fim de mês.",
    },
    "pib": {
        "sgs": 7326, "nome": "Crescimento do PIB", "unidade": "% ao ano",
        "frequencia": "anual", "desde": "1948-01-01", "faixa": (-10, 20),
        "nota": "Variação real anual do PIB (IBGE). Cada ano é atribuído ao governo que ocupou a maior parte dele.",
    },
}
