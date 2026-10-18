-- Séries mensais completas, com o governo e o mês do mandato de cada observação.
SELECT indicador, strftime(mes, '%Y-%m') AS mes, round(valor, 4) AS valor, governo_id, mes_mandato
FROM vw_mensal
ORDER BY indicador, mes;
