# Dashboard no Power BI

O Power BI Desktop é gratuito e não precisa de conta para montar e salvar o dashboard.

## Dados

O pipeline grava as tabelas em `data/powerbi/` (CSV com `;` e vírgula decimal):

| Arquivo | Conteúdo |
| --- | --- |
| `governos.csv` | Um governo por linha: presidente, início, fim, período histórico |
| `metricas.csv` | Indicadores resumidos por governo (início, fim, média, variação) |
| `series.csv` | Séries mensais com o governo e o mês do mandato |
| `pib.csv` | Crescimento anual do PIB e o governo de cada ano |

Para obter os arquivos sem rodar nada localmente, baixe o artefato `csv-powerbi` da última execução em **Actions** no GitHub.

## Montagem sugerida

1. **Obter dados → Texto/CSV** para os quatro arquivos (origem: Português (Brasil)).
2. Relacione `governos[id]` com `metricas[governo_id]`, `series[governo_id]` e `pib[governo_id]` (um para muitos).
3. Página 1, "Governo": segmentação por `presidente`, cartões com as métricas e gráficos de linha de `series` filtrados por indicador.
4. Página 2, "Comparar": duas segmentações com interações independentes e gráficos usando `mes_mandato` no eixo X.
5. Salve como `powerbi/brasil-por-governo.pbix` e exporte em PDF (**Arquivo → Exportar → PDF**) para `powerbi/brasil-por-governo.pdf`.

Publicar o relatório na web exige conta corporativa do Power BI; sem ela, o PDF exportado é o que vai para o site e para o portfólio.
