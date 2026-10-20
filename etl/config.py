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

# Séries do Ipeadata (http://www.ipeadata.gov.br, chave "ipea"), que republica as séries do Banco
# Central e do IBGE numa API aberta, e do Banco Mundial (https://data.worldbank.org, chave "bm"),
# que reúne indicadores sociais anuais do IBGE, do Ministério da Saúde e da ONU. A API do SGS do
# Banco Central recusa servidores fora do Brasil, como os do GitHub Actions, e por isso não é usada.
# "fonte" é quem produz o dado. "grupo" diz em que aba do site o indicador aparece:
# "dia" (o que a pessoa sente no dia a dia) ou "economia". "opcional" marca fontes sem API, que
# podem falhar sem derrubar o pipeline (o site então esconde o indicador).
# "faixa" é uma checagem de sanidade: se a maior parte dos valores cair fora dela, o código
# provavelmente está errado e o pipeline avisa. "desde" corta períodos em que a série não é
# comparável. "derivado" marca séries calculadas no PySpark a partir de outra.
INDICADORES = {
    "dolar": {
        "grupo": "economia", "ipea": "BM12_ERC12", "fonte": "Banco Central", "nome": "Dólar comercial", "unidade": "R$/US$",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (0.5, 10),
        "nota": "Média mensal da cotação de compra. Começa no Plano Real, quando a moeda passa a ser comparável.",
    },
    "ipca": {
        "grupo": "dia", "ipea": "PRECOS12_IPCAG12", "fonte": "IBGE", "nome": "Inflação (IPCA) no mês", "unidade": "% no mês",
        "frequencia": "mensal", "desde": "1980-01-01", "faixa": (-2, 90),
        "nota": "Variação mensal do IPCA, medido pelo IBGE.",
    },
    "ipca_12m": {
        "grupo": "dia", "derivado": "ipca", "nome": "Inflação (IPCA) em 12 meses", "unidade": "% em 12 meses",
        "frequencia": "mensal", "desde": "1980-01-01", "faixa": (-2, 7000),
        "nota": "IPCA acumulado nos 12 meses anteriores, calculado a partir da variação mensal.",
    },
    "selic": {
        "grupo": "economia", "ipea": "BM12_TJOVER12", "fonte": "Banco Central", "anualizar": True, "nome": "Taxa Selic", "unidade": "% ao ano",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (1, 70),
        "nota": "Selic acumulada no mês, anualizada. Começa no Plano Real.",
    },
    "desemprego": {
        "grupo": "dia", "ipea": "PNADC12_TDESOC12", "fonte": "IBGE", "nome": "Taxa de desemprego", "unidade": "%",
        "frequencia": "mensal", "desde": "2012-03-01", "faixa": (3, 20),
        "nota": "Taxa de desocupação da PNAD Contínua (IBGE), trimestre móvel. Série comparável começa em 2012.",
    },
    "divida": {
        "grupo": "economia", "ipea": "PAN12_DTSPY12", "fonte": "Banco Central", "nome": "Dívida líquida do setor público", "unidade": "% do PIB",
        "frequencia": "mensal", "desde": "1991-01-01", "faixa": (10, 100),
        "nota": "Dívida líquida do setor público consolidado (União, estados, municípios e estatais), fim de mês.",
    },
    "salario_minimo": {
        "grupo": "dia", "ipea": "MTE12_SALMIN12", "fonte": "Ministério do Trabalho", "nome": "Salário mínimo", "unidade": "R$",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (60, 5000),
        "nota": "Valor nominal. O site mostra também o valor real, corrigido pelo IPCA.",
    },
    "reservas": {
        "grupo": "economia", "ipea": "BM12_RES12", "fonte": "Banco Central", "nome": "Reservas internacionais", "unidade": "US$ milhões",
        "frequencia": "mensal", "desde": "1970-01-01", "faixa": (100, 500_000),
        "nota": "Reservas internacionais, fim de mês.",
    },
    "pib": {
        "grupo": "economia", "ipea": "SCN10_PIBG10", "fonte": "IBGE", "nome": "Crescimento do PIB", "unidade": "% ao ano",
        "frequencia": "anual", "desde": "1901-01-01", "faixa": (-10, 20),
        "nota": "Variação real anual do PIB (IBGE; antes de 1948, estimativas históricas). Cada ano é atribuído ao governo que ocupou a maior parte dele.",
    },
    "poder_compra": {
        "grupo": "dia", "dieese": True, "opcional": True, "fonte": "DIEESE", "nome": "Salário mínimo frente ao necessário", "unidade": "% do necessário",
        "frequencia": "mensal", "desde": "1994-07-01", "faixa": (8, 60),
        "nota": "Quanto o salário mínimo representa do salário mínimo necessário calculado pelo DIEESE: o que uma família de quatro pessoas precisaria para cobrir alimentação, moradia, saúde, educação, transporte e outras despesas básicas, a partir do preço da cesta básica mais cara entre as capitais.",
    },
    "renda": {
        "grupo": "dia", "ipea": "PNADC12_RRTH12", "fonte": "IBGE", "nome": "Renda média do trabalhador", "unidade": "R$ de hoje",
        "frequencia": "mensal", "desde": "2012-03-01", "faixa": (1000, 10000),
        "nota": "Rendimento real médio de todos os trabalhos (PNAD Contínua, IBGE), já corrigido pela inflação. Série comparável começa em 2012.",
    },
    "pobreza": {
        "grupo": "dia", "bm": "SI.POV.UMIC", "fonte": "Banco Mundial, com dados do IBGE", "nome": "Pobreza", "unidade": "% da população",
        "frequencia": "anual", "desde": "1981-01-01", "faixa": (5, 90),
        "nota": "Parcela da população que vive com menos de US$ 8,30 por dia, em dólares ajustados pelo custo de vida (PPC de 2021). Linha de pobreza do Banco Mundial para países de renda média-alta, como o Brasil.",
    },
    "extrema_pobreza": {
        "grupo": "dia", "bm": "SI.POV.DDAY", "fonte": "Banco Mundial, com dados do IBGE", "nome": "Extrema pobreza", "unidade": "% da população",
        "frequencia": "anual", "desde": "1981-01-01", "faixa": (0.5, 60),
        "nota": "Parcela da população que vive com menos de US$ 3,00 por dia, em dólares ajustados pelo custo de vida (PPC de 2021). Linha internacional de extrema pobreza.",
    },
    "saneamento": {
        "grupo": "dia", "bm": "SH.STA.BASS.ZS", "fonte": "OMS/Unicef (JMP), via Banco Mundial", "nome": "Acesso a saneamento básico", "unidade": "% da população",
        "frequencia": "anual", "desde": "2000-01-01", "faixa": (40, 100),
        "nota": "Parcela da população com pelo menos saneamento básico: banheiro ligado à rede de esgoto, fossa séptica ou equivalente, não compartilhado. Estimativa do programa conjunto OMS/Unicef, que começa em 2000.",
    },
    "mortalidade_infantil": {
        "grupo": "dia", "bm": "SP.DYN.IMRT.IN", "fonte": "ONU (IGME), via Banco Mundial", "nome": "Mortalidade infantil", "unidade": "mortes por mil nascidos vivos",
        "frequencia": "anual", "desde": "1960-01-01", "faixa": (5, 200),
        "nota": "Bebês que morrem antes de completar 1 ano, a cada mil nascidos vivos. Estimativa do grupo da ONU para mortalidade infantil, com base em dados do IBGE e do Ministério da Saúde.",
    },
    "expectativa_vida": {
        "grupo": "dia", "bm": "SP.DYN.LE00.IN", "fonte": "ONU (World Population Prospects), via Banco Mundial", "nome": "Expectativa de vida", "unidade": "anos",
        "frequencia": "anual", "desde": "1960-01-01", "faixa": (40, 90),
        "nota": "Quantos anos, em média, vive uma pessoa que nasce naquele ano.",
    },
    "homicidios": {
        "grupo": "dia", "bm": "VC.IHR.PSRC.P5", "fonte": "UNODC, via Banco Mundial", "nome": "Homicídios", "unidade": "por 100 mil habitantes",
        "frequencia": "anual", "desde": "1990-01-01", "faixa": (5, 60),
        "nota": "Homicídios intencionais por 100 mil habitantes, segundo o Escritório da ONU sobre Drogas e Crime, com base em dados do Ministério da Saúde.",
    },
    "analfabetismo": {
        "grupo": "dia", "bm": "SE.ADT.LITR.ZS", "complemento": True, "fonte": "IBGE e Unesco, via Banco Mundial", "nome": "Analfabetismo", "unidade": "% de quem tem 15 anos ou mais",
        "frequencia": "anual", "desde": "1970-01-01", "faixa": (1, 50),
        "nota": "Parcela das pessoas com 15 anos ou mais que não sabem ler e escrever. Antes de 2004 só há dados de alguns anos.",
    },
}
