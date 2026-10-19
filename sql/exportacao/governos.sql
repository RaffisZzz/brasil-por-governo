-- Governos com duração em dias, para o seletor do site.
SELECT id, presidente, strftime(inicio, '%Y-%m-%d') AS inicio, strftime(fim, '%Y-%m-%d') AS fim,
       em_curso, periodo_historico, observacao, partido, wikipedia, datediff('day', inicio, fim) AS dias
FROM dim_governo
ORDER BY ordem;
