-- Acontecimentos marcantes, em ordem cronológica.
SELECT governo_id, strftime(data, '%Y-%m-%d') AS data, precisao, categoria, titulo, descricao
FROM fato_acontecimento
ORDER BY data;
