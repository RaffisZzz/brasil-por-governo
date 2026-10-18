-- Indicadores resumidos por governo (formato longo: uma linha por governo e indicador).
SELECT governo_id, indicador, meses, cobertura,
       strftime(primeiro_mes, '%Y-%m') AS primeiro_mes, strftime(ultimo_mes, '%Y-%m') AS ultimo_mes,
       round(valor_inicio, 4) AS valor_inicio, round(valor_fim, 4) AS valor_fim, round(media, 4) AS media,
       round(acumulado, 2) AS acumulado, round(media_anual, 2) AS media_anual,
       round(variacao_pct, 2) AS variacao_pct, round(variacao_pp, 2) AS variacao_pp
FROM metricas_governo
ORDER BY governo_id, indicador;
