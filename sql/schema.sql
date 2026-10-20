-- Warehouse em DuckDB: dimensão de governos, fatos mensais e anuais, e as visões de análise.
-- {curado} é preenchido por etl/build_warehouse.py.

CREATE OR REPLACE TABLE dim_governo AS
SELECT id, presidente, inicio, fim, em_curso, periodo_historico, coalesce(observacao, '') AS observacao,
       partido, wikipedia, ordem
FROM read_parquet('{curado}/governos/*.parquet');

CREATE OR REPLACE TABLE fato_mensal AS
SELECT indicador, mes, valor, governo_id
FROM read_parquet('{curado}/serie_mensal/*.parquet');

-- Séries anuais: o PIB e os indicadores sociais. Cada ano pertence ao governo que ocupou mais dias dele.
CREATE OR REPLACE TABLE fato_anual AS
SELECT indicador, ano, valor, governo_id
FROM read_parquet('{curado}/serie_anual/*.parquet');

CREATE OR REPLACE VIEW fato_pib AS
SELECT ano, valor AS crescimento, governo_id FROM fato_anual WHERE indicador = 'pib';

CREATE OR REPLACE TABLE fato_acontecimento AS
SELECT governo_id, data, precisao, categoria, titulo, descricao, coalesce(fonte, '') AS fonte, coalesce(link, '') AS link
FROM read_parquet('{curado}/acontecimentos/*.parquet');

-- Número-índice de preços: produto acumulado das variações mensais do IPCA.
CREATE OR REPLACE VIEW vw_indice_ipca AS
SELECT mes, exp(sum(ln(1 + valor / 100)) OVER (ORDER BY mes)) AS indice
FROM fato_mensal
WHERE indicador = 'ipca';

-- Salário mínimo real, em reais do último mês com IPCA divulgado.
CREATE OR REPLACE VIEW vw_salario_real AS
WITH base AS (SELECT indice FROM vw_indice_ipca ORDER BY mes DESC LIMIT 1)
SELECT 'salario_real' AS indicador, s.mes, s.valor * base.indice / i.indice AS valor, s.governo_id
FROM fato_mensal s
JOIN vw_indice_ipca i USING (mes)
CROSS JOIN base
WHERE s.indicador = 'salario_minimo';

-- Séries anuais no mesmo formato, para o site: o "mês" é o ano e o mês do mandato conta anos inteiros.
CREATE OR REPLACE VIEW vw_anual AS
SELECT a.indicador, CAST(a.ano AS VARCHAR) AS periodo, a.valor, a.governo_id,
       12 * (a.ano - year(g.inicio)) AS mes_mandato
FROM fato_anual a
LEFT JOIN dim_governo g ON g.id = a.governo_id
WHERE a.indicador <> 'pib';

-- Todas as séries mensais, já com o mês do mandato (0 = mês da posse).
CREATE OR REPLACE VIEW vw_mensal AS
WITH todas AS (
    SELECT indicador, mes, valor, governo_id FROM fato_mensal
    UNION ALL
    SELECT indicador, mes, valor, governo_id FROM vw_salario_real
)
SELECT t.*, datediff('month', date_trunc('month', g.inicio), t.mes) AS mes_mandato
FROM todas t
LEFT JOIN dim_governo g ON g.id = t.governo_id;

-- Uma linha por governo e indicador: valor no primeiro e no último mês, média,
-- inflação acumulada e se a série cobre o mandato inteiro ou só parte dele.
CREATE OR REPLACE TABLE metricas_governo AS
WITH ordenado AS (
    SELECT *,
        row_number() OVER (PARTITION BY governo_id, indicador ORDER BY mes)      AS pos_ini,
        row_number() OVER (PARTITION BY governo_id, indicador ORDER BY mes DESC) AS pos_fim
    FROM vw_mensal
    WHERE governo_id IS NOT NULL
),
mensais AS (
    SELECT
        governo_id, indicador,
        count(*)                                     AS meses,
        min(mes)                                     AS primeiro_mes,
        max(mes)                                     AS ultimo_mes,
        max(valor) FILTER (WHERE pos_ini = 1)        AS valor_inicio,
        max(valor) FILTER (WHERE pos_fim = 1)        AS valor_fim,
        avg(valor)                                   AS media,
        CASE WHEN indicador = 'ipca' THEN 100 * (exp(sum(ln(1 + valor / 100))) - 1) END AS acumulado
    FROM ordenado
    GROUP BY governo_id, indicador
),
anuais AS (
    SELECT
        governo_id, indicador,
        count(*)                                          AS meses,  -- aqui conta anos
        make_date(min(ano), 1, 1)                         AS primeiro_mes,
        make_date(max(ano), 12, 1)                        AS ultimo_mes,
        arg_min(valor, ano)                               AS valor_inicio,
        arg_max(valor, ano)                               AS valor_fim,
        avg(valor)                                        AS media,
        CASE WHEN indicador = 'pib' THEN 100 * (exp(sum(ln(1 + valor / 100))) - 1) END AS acumulado
    FROM fato_anual
    WHERE governo_id IS NOT NULL
    GROUP BY governo_id, indicador
)
SELECT
    m.*,
    CASE WHEN m.indicador = 'ipca' THEN 100 * (power(1 + m.acumulado / 100, 12.0 / m.meses) - 1) END AS media_anual,
    CASE WHEN m.indicador IN ('dolar', 'salario_minimo', 'salario_real', 'reservas', 'renda')
         THEN 100 * (m.valor_fim / m.valor_inicio - 1) END                                            AS variacao_pct,
    -- Diferença entre o fim e o início, na unidade do próprio indicador (p.p., anos, mortes por mil...).
    CASE WHEN m.indicador NOT IN ('dolar', 'salario_minimo', 'salario_real', 'reservas', 'renda', 'pib', 'ipca')
         THEN m.valor_fim - m.valor_inicio END                                                        AS variacao_pp,
    CASE WHEN m.indicador IN (SELECT DISTINCT indicador FROM fato_anual) THEN 'anual'
         WHEN m.primeiro_mes > date_trunc('month', g.inicio) + INTERVAL 1 MONTH THEN 'parcial'
         ELSE 'completa' END                                                                          AS cobertura
FROM (SELECT * FROM mensais UNION ALL SELECT * FROM anuais) m
JOIN dim_governo g ON g.id = m.governo_id;
