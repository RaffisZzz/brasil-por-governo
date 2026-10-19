-- Polêmicas de cada governo, em ordem cronológica, com o desfecho quando houve.
SELECT governo_id, strftime(data, '%Y-%m-%d') AS data, precisao, titulo, descricao, desfecho
FROM fato_polemica
ORDER BY data;
