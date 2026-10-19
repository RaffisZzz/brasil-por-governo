"""Configuração central: caminhos e o catálogo de indicadores coletados no Ipeadata."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GOVERNOS_CSV = RAIZ / "dados" / "governos.csv"
ACONTECIMENTOS_CSV = RAIZ / "dados" / "acontecimentos.csv"
POLEMICAS_CSV = RAIZ / "dados" / "polemicas.csv"
DADOS = RAIZ / "data"
BRUTO = DADOS / "raw"            # séries como vieram da API, em Parquet
CURADO = DADOS / "curated"       # saída do PySpark
WAREHOUSE = DADOS / "warehouse.duckdb"
SITE_DADOS = RAIZ / "site" / "data"
MARCA_AMOSTRA = BRUTO / "AMOSTRA_SINTETICA"

# Séries do Ipeadata (http://www.ipeadata.gov.br), que republica as séries do Banco Central
# e do IBGE numa API aberta. A API do SGS do Banco Central recusa servidores fora do Brasil,
# como os do GitHub Actions, e por isso não é usada. "fonte" é quem produz o dado.
# "faixa" é uma checagem de sanidade: se a maior parte dos valores cair fora dela, o código
# provavelmente está errado e o pipeline avisa. "desde" corta períodos em que a série não é
# comparável. "derivado" marca séries calculadas no PySpark a partir de outra.
INDICADORES = {
    "dolar": {
        "ipea": "BM12_ERC12", "fonte": "Banco Central", "nome": "Dólar comercial", "unidade": "R$/US$",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (0.5, 10),
        "nota": "Média mensal da cotação de compra. Começa no Plano Real, quando a moeda passa a ser comparável.",
    },
    "ipca": {
        "ipea": "PRECOS12_IPCAG12", "fonte": "IBGE", "nome": "Inflação (IPCA) no mês", "unidade": "% no mês",
        "frequencia": "mensal", "desde": "1980-01-01", "faixa": (-2, 90),
        "nota": "Variação mensal do IPCA, medido pelo IBGE.",
    },
    "ipca_12m": {
        "derivado": "ipca", "nome": "Inflação (IPCA) em 12 meses", "unidade": "% em 12 meses",
        "frequencia": "mensal", "desde": "1980-01-01", "faixa": (-2, 7000),
        "nota": "IPCA acumulado nos 12 meses anteriores, calculado a partir da variação mensal.",
    },
    "selic": {
        "ipea": "BM12_TJOVER12", "fonte": "Banco Central", "anualizar": True, "nome": "Taxa Selic", "unidade": "% ao ano",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (1, 70),
        "nota": "Selic acumulada no mês, anualizada. Começa no Plano Real.",
    },
    "desemprego": {
        "ipea": "PNADC12_TDESOC12", "fonte": "IBGE", "nome": "Taxa de desemprego", "unidade": "%",
        "frequencia": "mensal", "desde": "2012-03-01", "faixa": (3, 20),
        "nota": "Taxa de desocupação da PNAD Contínua (IBGE), trimestre móvel. Série comparável começa em 2012.",
    },
    "divida": {
        "ipea": "PAN12_DTSPY12", "fonte": "Banco Central", "nome": "Dívida líquida do setor público", "unidade": "% do PIB",
        "frequencia": "mensal", "desde": "1991-01-01", "faixa": (10, 100),
        "nota": "Dívida líquida do setor público consolidado (União, estados, municípios e estatais), fim de mês.",
    },
    "salario_minimo": {
        "ipea": "MTE12_SALMIN12", "fonte": "Ministério do Trabalho", "nome": "Salário mínimo", "unidade": "R$",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (60, 5000),
        "nota": "Valor nominal. O site mostra também o valor real, corrigido pelo IPCA.",
    },
    "reservas": {
        "ipea": "BM12_RES12", "fonte": "Banco Central", "nome": "Reservas internacionais", "unidade": "US$ milhões",
        "frequencia": "mensal", "desde": "1970-01-01", "faixa": (100, 500_000),
        "nota": "Reservas internacionais, fim de mês.",
    },
    "pib": {
        "ipea": "SCN10_PIBG10", "fonte": "IBGE", "nome": "Crescimento do PIB", "unidade": "% ao ano",
        "frequencia": "anual", "desde": "1901-01-01", "faixa": (-10, 20),
        "nota": "Variação real anual do PIB (IBGE; antes de 1948, estimativas históricas). Cada ano é atribuído ao governo que ocupou a maior parte dele.",
    },
}
