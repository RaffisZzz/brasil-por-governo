-- Crescimento anual do PIB e o governo a que cada ano foi atribuído.
SELECT ano, round(crescimento, 2) AS crescimento, governo_id
FROM fato_pib
ORDER BY ano;
