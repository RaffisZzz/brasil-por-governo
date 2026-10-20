-- Séries completas, com o governo e o mês do mandato de cada observação.
-- As mensais vêm com o mês (AAAA-MM); as anuais, menos o PIB, com o ano (AAAA).
SELECT indicador, strftime(mes, '%Y-%m') AS mes, round(valor, 4) AS valor, governo_id, mes_mandato
FROM vw_mensal
UNION ALL
SELECT indicador, periodo, round(valor, 4), governo_id, mes_mandato
FROM vw_anual
ORDER BY indicador, mes;
