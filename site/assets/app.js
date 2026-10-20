// Brasil por Governo: lê os JSON de site/data/ (gerados por etl/export_site.py) e monta as três vistas.

const D = {}; // governos, metricas, series, pib, indicadores, meta
const graficos = new Map(); // id do elemento -> { g, opcoes }

// ---------- formatação ----------
const nf = (casas) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const SEM_INFO = "Sem informação";
const fmt = (v, casas = 1) => (v == null || Number.isNaN(v) ? "–" : nf(casas).format(v));
const sinal = (v, casas = 1) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(casas).format(Math.abs(v))}`);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataLonga = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES.at(m - 1)} ${a}`;
};
const mesCurto = (ym) => `${MESES.at(Number(ym.slice(5, 7)) - 1)}/${ym.slice(0, 4)}`;
const duracao = (dias) => {
  const total = Math.round(dias / 30.44);
  const anos = Math.floor(total / 12);
  const meses = total % 12;
  const partes = [];
  if (anos) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
  if (meses) partes.push(`${meses} ${meses === 1 ? "mês" : "meses"}`);
  return partes.join(" e ") || `${dias} dias`;
};
const anoDe = (iso) => iso.slice(0, 4);
// O fim é o dia da posse do sucessor; o último ano no cargo é o do dia anterior.
const anoFim = (g) => (g.em_curso ? "atual" : String(new Date(Date.parse(g.fim) - 864e5).getUTCFullYear()));
const anos = (g) => (anoDe(g.inicio) === anoFim(g) ? anoDe(g.inicio) : `${anoDe(g.inicio)}–${anoFim(g)}`);
// Nomes como "Lula (2003–2010)" já trazem os anos no CSV; aqui ficam só com o nome.
const nome = (g) => g.presidente.replace(/ \(.*\)$/, "");
const rotulo = (g) => `${nome(g)} (${anos(g)})`;
const iniciais = (g) => nome(g).split(" ").filter((p) => p.length > 2 && p[0] === p[0].toUpperCase()).slice(0, 2).map((p) => p[0]).join("");
// Foto da Wikipédia (etl/fotos.py) ou, se não houver, um círculo com as iniciais.
function retrato(g, classe = "") {
  if (g.foto) return el("img", { class: `retrato ${classe}`, src: g.foto, alt: `Foto de ${nome(g)}`, loading: "lazy" });
  return el("span", { class: `retrato sem-foto ${classe}`, "aria-hidden": "true" }, iniciais(g));
}

// ---------- utilidades ----------
const cor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  filhos.flat().forEach((f) => f != null && n.append(f));
  return n;
}
const governo = (id) => D.governos.find((g) => g.id === id);
const eventosDe = (gid) => D.acontecimentos.filter((e) => e.governo_id === gid);
const dataEvento = (e) => (e.precisao === "dia" ? dataLonga(e.data)
  : e.precisao === "mes" ? `${MESES.at(Number(e.data.slice(5, 7)) - 1)} ${anoDe(e.data)}` : anoDe(e.data));

function listaEventos(eventos) {
  return eventos.map((e) => el("li", { class: "evento" },
    el("span", { class: "evento-data" }, dataEvento(e)),
    el("div", {},
      el("span", { class: "evento-titulo" }, e.titulo), e.categoria ? el("span", { class: "tag" }, e.categoria) : null,
      el("p", { class: "evento-desc" }, e.descricao),
      e.desfecho ? el("p", { class: "evento-desfecho" }, el("strong", {}, "Desfecho: "), e.desfecho) : null)));
}
const metrica = (gid, ind) => D.metricas.find((m) => m.governo_id === gid && m.indicador === ind);

// ---------- o que cada cartão mostra ----------
// Os indicadores ficam em dois grupos, cada um numa aba: "dia" (o que se sente no dia a dia) e "economia".
const GRUPOS = { dia: "No dia a dia", economia: "Economia" };
let grupo = "dia";

// principal/sub recebem a linha de metricas.json; "numero" é o valor que a coluna "Maior número"
// do Comparar usa, e "dif" escreve a diferença entre dois governos (padrão: pontos percentuais).
const pp = (d) => `${fmt(d)} p.p. a mais`;
const anoIni = (m) => anoDe(m.primeiro_mes);
const anoFimM = (m) => anoDe(m.ultimo_mes);
// Indicadores anuais medidos em nível (pobreza, saneamento...): o último valor do mandato e o primeiro.
function nivelAnual(ind, rotulo, u, melhor, casas = 1) {
  return {
    ind, grupo: "dia", rotulo, anual: true, melhor,
    principal: (m) => `${fmt(m.valor_fim, casas)}${u.curta}`,
    sub: (m) => (anoIni(m) === anoFimM(m) ? `${u.longa} em ${anoFimM(m)}`
      : `${u.longa} em ${anoFimM(m)}; era ${fmt(m.valor_inicio, casas)}${u.curta} em ${anoIni(m)}`),
    numero: (m) => m.valor_fim,
    dif: (d) => `${fmt(d, casas)}${u.dif} a mais`,
  };
}
const CARTOES = [
  {
    ind: "ipca", grupo: "dia", rotulo: "Quanto os preços subiram",
    // A inflação melhora quando a taxa em 12 meses cai entre o início e o fim do mandato.
    melhor: "cair", variacao: (m, gid) => { const t = metrica(gid, "ipca_12m"); return t && t.valor_fim - t.valor_inicio; },
    principal: (m) => `${fmt(m.acumulado)}%`,
    sub: (m) => `no mandato todo, ou ${fmt(m.media_anual)}% ao ano (IPCA)`,
    numero: (m) => m.media_anual, dif: (d) => `${fmt(d)} p.p. ao ano a mais`,
  },
  {
    ind: "salario_real", grupo: "dia", rotulo: "Salário mínimo, descontada a inflação", melhor: "subir",
    principal: (m) => `${sinal(m.variacao_pct)}%`,
    sub: (m) => `de R$ ${fmt(m.valor_inicio, 0)} para R$ ${fmt(m.valor_fim, 0)} (em reais de hoje)`,
    numero: (m) => m.variacao_pct,
  },
  {
    ind: "poder_compra", grupo: "dia", rotulo: "Salário mínimo frente ao custo de vida", melhor: "subir",
    principal: (m) => `${fmt(m.valor_fim, 0)}%`,
    sub: (m) => `do salário necessário para uma família de 4 (DIEESE); era ${fmt(m.valor_inicio, 0)}% no início`,
    numero: (m) => m.valor_fim,
  },
  {
    ind: "renda", grupo: "dia", rotulo: "Renda média do trabalhador", melhor: "subir",
    principal: (m) => `R$ ${fmt(m.valor_fim, 0)}`,
    sub: (m) => `por mês, em reais de hoje; era R$ ${fmt(m.valor_inicio, 0)} no início (${sinal(m.variacao_pct)}%)`,
    numero: (m) => m.valor_fim, dif: (d) => `R$ ${fmt(d, 0)} a mais`,
  },
  {
    ind: "desemprego", grupo: "dia", rotulo: "Desemprego", melhor: "cair",
    principal: (m) => `${fmt(m.valor_fim)}%`,
    sub: (m) => `no fim (${mesCurto(m.ultimo_mes)}); era ${fmt(m.valor_inicio)}% no início`,
    numero: (m) => m.valor_fim,
  },
  nivelAnual("pobreza", "Pessoas na pobreza", { curta: "%", longa: "da população", dif: " p.p." }, "cair"),
  nivelAnual("extrema_pobreza", "Pessoas na extrema pobreza", { curta: "%", longa: "da população", dif: " p.p." }, "cair"),
  nivelAnual("saneamento", "Acesso a saneamento básico", { curta: "%", longa: "da população", dif: " p.p." }, "subir"),
  nivelAnual("mortalidade_infantil", "Mortalidade infantil", { curta: "", longa: "bebês mortos por mil nascidos", dif: " por mil" }, "cair"),
  nivelAnual("expectativa_vida", "Expectativa de vida", { curta: " anos", longa: "ao nascer", dif: " anos" }, "subir"),
  nivelAnual("homicidios", "Homicídios", { curta: "", longa: "por 100 mil habitantes", dif: " por 100 mil" }, "cair"),
  nivelAnual("analfabetismo", "Analfabetismo", { curta: "%", longa: "de quem tem 15 anos ou mais", dif: " p.p." }, "cair"),
  {
    ind: "pib", grupo: "economia", rotulo: "Crescimento do PIB",
    melhor: "subir", variacao: (m) => m.media, selos: ["Cresceu", "Encolheu"], // pela média do mandato
    principal: (m) => `${sinal(m.media)}% ao ano`,
    sub: (m) => `${sinal(m.acumulado)}% no total, em ${m.meses} ${m.meses === 1 ? "ano" : "anos"}`,
    numero: (m) => m.media,
  },
  {
    ind: "dolar", grupo: "economia", rotulo: "Dólar",
    principal: (m) => `${sinal(m.variacao_pct)}%`,
    sub: (m) => `de R$ ${fmt(m.valor_inicio, 2)} para R$ ${fmt(m.valor_fim, 2)}`,
    numero: (m) => m.variacao_pct,
  },
  {
    ind: "selic", grupo: "economia", rotulo: "Taxa Selic",
    principal: (m) => `${fmt(m.media)}% ao ano`,
    sub: (m) => `média do mandato; de ${fmt(m.valor_inicio)}% para ${fmt(m.valor_fim)}%`,
    numero: (m) => m.media,
  },
  {
    ind: "divida", grupo: "economia", rotulo: "Dívida líquida do setor público", melhor: "cair",
    principal: (m) => `${sinal(m.variacao_pp)} p.p. do PIB`,
    sub: (m) => `de ${fmt(m.valor_inicio)}% para ${fmt(m.valor_fim)}% do PIB`,
    numero: (m) => m.variacao_pp,
  },
  {
    ind: "reservas", grupo: "economia", rotulo: "Reservas internacionais", melhor: "subir",
    principal: (m) => `${sinal(m.variacao_pct)}%`,
    sub: (m) => `de US$ ${fmt(m.valor_inicio / 1000, 1)} bi para US$ ${fmt(m.valor_fim / 1000, 1)} bi`,
    numero: (m) => m.variacao_pct,
  },
];
// Verde ou vermelho: o indicador melhorou ou piorou entre o início e o fim do mandato.
// "melhor" diz se é bom o número subir ou cair; dólar e Selic não têm, porque subir ou cair
// pode ser bom ou ruim dependendo de quem olha, e ficam sem cor.
function tendencia(cfg, m, gid) {
  if (!cfg.melhor || !m) return null;
  const d = cfg.variacao ? cfg.variacao(m, gid) : m.valor_fim - m.valor_inicio;
  if (d == null || Number.isNaN(d) || Math.abs(d) < 1e-6) return null;
  return (d > 0) === (cfg.melhor === "subir") ? "melhorou" : "piorou";
}
const seloTendencia = (t, cfg) => t && el("span", { class: `selo ${t}` },
  t === "melhorou" ? `✓ ${cfg.selos?.[0] ?? "Melhorou"}` : `✕ ${cfg.selos?.[1] ?? "Piorou"}`);

const baseDe = (ind) => (ind === "salario_real" ? "salario_minimo" : ind);
// Só entram os cartões cujos dados o pipeline exportou.
const cartoesDo = (gr) => CARTOES.filter((c) => c.grupo === gr && D.indicadores[baseDe(c.ind)]);
const desdeDe = (ind) => D.indicadores[baseDe(ind)]?.desde?.slice(0, 4);

// Abas "No dia a dia" / "Economia", usadas nas três vistas.
function abasGrupo(destino, aoTrocar) {
  destino.replaceChildren(...Object.entries(GRUPOS).map(([id, titulo]) =>
    el("button", { type: "button", role: "tab", class: "segmento-botao", "aria-selected": String(id === grupo),
      onclick: () => aoTrocar(id) }, titulo)));
}
const grupoDaRota = (g) => (g in GRUPOS ? g : "dia");

// ---------- gráficos ----------
function desenhar(container, id, opcoes, altura = 260) {
  const div = el("div", { id, class: "grafico", role: "img" });
  div.style.height = `${altura}px`;
  container.append(div);
  if (typeof echarts === "undefined") {
    div.replaceChildren(el("p", { class: "explica" }, "Não foi possível carregar a biblioteca de gráficos. Recarregue a página."));
    return;
  }
  // Um gráfico com problema não pode impedir que os outros sejam desenhados.
  try {
    const g = echarts.init(div, null, { renderer: "svg" });
    g.setOption(opcoes());
    // O cartão muda de largura quando os seguintes entram na grade (o primeiro nasce
    // ocupando a linha inteira); sem isto o gráfico guarda a largura inicial e invade o vizinho.
    const obs = new ResizeObserver(() => g.resize());
    obs.observe(div);
    graficos.set(id, { g, opcoes, obs });
  } catch (erro) {
    console.error(`Gráfico ${id}:`, erro);
    div.replaceChildren(el("p", { class: "explica" }, "Não foi possível desenhar este gráfico."));
  }
}
function limparGraficos(prefixo) {
  for (const [id, { g, obs }] of graficos) {
    if (id.startsWith(prefixo)) { obs.disconnect(); g.dispose(); graficos.delete(id); }
  }
}
const eixo = () => ({
  axisLine: { lineStyle: { color: cor("--historico") } },
  axisTick: { show: false },
  axisLabel: { color: cor("--text-secondary"), fontSize: 11.5 },
  splitLine: { lineStyle: { color: cor("--grade") } },
});
const dica = () => ({
  backgroundColor: cor("--surface-1"), borderColor: cor("--borda"),
  textStyle: { color: cor("--text-primary"), fontSize: 13 },
});
const base = () => ({ animation: false, textStyle: { fontFamily: "system-ui, sans-serif" } });

function cartaoGrafico(destino, titulo, explica) {
  const c = el("div", { class: "cartao" }, el("h2", {}, titulo), explica ? el("p", { class: "explica" }, explica) : null);
  destino.append(c);
  return c;
}

// "anual" marca séries com um valor por ano (o eixo e a dica mostram o ano, não o mês).
const GRAFICOS_LINHA = [
  { ind: "ipca_12m", grupo: "dia", titulo: "Inflação em 12 meses", unidade: "%", casas: 1 },
  { ind: "salario_real", grupo: "dia", titulo: "Salário mínimo, descontada a inflação", unidade: "R$ de hoje", casas: 0 },
  { ind: "poder_compra", grupo: "dia", titulo: "Salário mínimo frente ao custo de vida", unidade: "% do salário necessário (DIEESE)", casas: 0 },
  { ind: "renda", grupo: "dia", titulo: "Renda média do trabalhador", unidade: "R$ de hoje por mês", casas: 0 },
  { ind: "desemprego", grupo: "dia", titulo: "Desemprego", unidade: "%", casas: 1 },
  { ind: "pobreza", grupo: "dia", titulo: "Pessoas na pobreza", unidade: "% da população", casas: 1, anual: true },
  { ind: "extrema_pobreza", grupo: "dia", titulo: "Pessoas na extrema pobreza", unidade: "% da população", casas: 1, anual: true },
  { ind: "saneamento", grupo: "dia", titulo: "Acesso a saneamento básico", unidade: "% da população", casas: 1, anual: true },
  { ind: "mortalidade_infantil", grupo: "dia", titulo: "Mortalidade infantil", unidade: "mortes por mil nascidos vivos", casas: 1, anual: true },
  { ind: "expectativa_vida", grupo: "dia", titulo: "Expectativa de vida", unidade: "anos", casas: 1, anual: true },
  { ind: "homicidios", grupo: "dia", titulo: "Homicídios", unidade: "por 100 mil habitantes", casas: 1, anual: true },
  { ind: "analfabetismo", grupo: "dia", titulo: "Analfabetismo", unidade: "% de quem tem 15 anos ou mais", casas: 1, anual: true },
  { ind: "dolar", grupo: "economia", titulo: "Dólar", unidade: "R$", casas: 2 },
  { ind: "selic", grupo: "economia", titulo: "Taxa Selic", unidade: "% a.a.", casas: 1 },
  { ind: "divida", grupo: "economia", titulo: "Dívida líquida do setor público", unidade: "% do PIB", casas: 1 },
  { ind: "reservas", grupo: "economia", titulo: "Reservas internacionais", unidade: "US$ bi", casas: 1, escala: 1 / 1000 },
];

// Séries anuais com anos faltando (o analfabetismo, por exemplo) ganham os anos vazios,
// para que o eixo não junte 1980 e 2000 lado a lado.
function preencherAnos(serie) {
  if (!serie.length) return serie;
  const porAno = new Map(serie.map((p) => [Number(p[0]), p]));
  const [a0, a1] = [Number(serie[0][0]), Number(serie.at(-1)[0])];
  return Array.from({ length: a1 - a0 + 1 }, (_, i) => porAno.get(a0 + i) ?? [String(a0 + i), null, null, null]);
}

function graficoHistorico(destino, cfg, g) {
  const serie = cfg.anual ? preencherAnos(D.series[cfg.ind] || []) : D.series[cfg.ind] || [];
  if (!serie.some((p) => p[2] === g.id)) return false;
  const k = cfg.escala ?? 1;
  const meses = serie.map((p) => p[0]);
  const valor = (p) => (p[1] == null ? null : p[1] * k);
  const todos = serie.map(valor);
  const mandato = serie.map((p) => (p[2] === g.id ? valor(p) : null));
  const quem = serie.map((p) => governo(p[2])?.presidente ?? "sem dado neste ano");
  const iniMandato = meses.findIndex((_, i) => serie[i][2] === g.id);
  const fimMandato = meses.length - 1 - [...serie].reverse().findIndex((p) => p[2] === g.id);
  // Janela inicial: o mandato com até 4 anos de contexto de cada lado (séries anuais: 8 anos).
  const folga = cfg.anual ? 8 : 48;
  const ini = Math.max(0, iniMandato - folga);
  const fim = Math.min(meses.length - 1, fimMandato + folga);

  // Acontecimentos do mandato com precisão de dia ou mês viram linhas verticais no gráfico.
  // Nas séries anuais, o "mês" já é o ano.
  const chave = (e) => e.data.slice(0, cfg.anual ? 4 : 7);
  const eventos = eventosDe(g.id).filter((e) => (cfg.anual || e.precisao !== "ano") && meses.includes(chave(e)));
  const eventosNoMes = (ym) => eventos.filter((e) => chave(e) === ym);
  const quando = (i) => (cfg.anual ? meses[i] : mesCurto(meses[i]));
  const ultimo = cfg.anual ? `último dado: ${meses.at(-1)}` : "";

  const c = cartaoGrafico(destino, cfg.titulo,
    [cfg.unidade, ultimo, "arraste a barra de baixo para ver outros períodos"].filter(Boolean).join(" · "));
  desenhar(c, `g-${cfg.ind}`, () => ({
    ...base(),
    grid: { left: 48, right: 16, top: 12, bottom: 64 },
    tooltip: {
      ...dica(), trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: cor("--historico") } },
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        if (todos[i] == null) return `${quando(i)}: ${SEM_INFO.toLowerCase()}`;
        const extra = eventosNoMes(meses[i]).map((e) => `<br>◆ ${e.titulo}`).join("");
        return `${quando(i)} · ${quem[i]}<br><strong>${fmt(todos[i], cfg.casas)}</strong> ${cfg.unidade}${extra}`;
      },
    },
    xAxis: { type: "category", data: meses, ...eixo(), axisLabel: { ...eixo().axisLabel, formatter: (v) => v.slice(0, 4) } },
    yAxis: { type: "value", scale: true, ...eixo(), axisLine: { show: false } },
    dataZoom: [
      { type: "slider", startValue: ini, endValue: fim, height: 22, bottom: 8, brushSelect: false,
        borderColor: cor("--borda"), fillerColor: cor("--faixa"), textStyle: { color: cor("--text-muted") },
        handleStyle: { color: cor("--surface-1"), borderColor: cor("--historico") },
        dataBackground: { lineStyle: { color: cor("--historico") }, areaStyle: { color: cor("--grade") } },
        labelFormatter: (i) => meses[i]?.slice(0, 4) ?? "" },
    ],
    series: [
      { name: "Histórico", type: "line", data: todos, showSymbol: !!cfg.anual, symbolSize: 4, connectNulls: true, lineStyle: { width: 1.5, color: cor("--historico") },
        itemStyle: { color: cor("--historico") },
        markArea: { silent: true, itemStyle: { color: cor("--faixa") }, data: [[{ xAxis: meses[iniMandato] }, { xAxis: meses[fimMandato] }]] } },
      { name: g.presidente, type: "line", data: mandato, showSymbol: !!cfg.anual, symbolSize: 7, connectNulls: false,
        lineStyle: { width: 2.5, color: cor("--serie-a") }, itemStyle: { color: cor("--serie-a") },
        markLine: { silent: true, symbol: "none", label: { show: false },
          lineStyle: { color: cor("--text-muted"), type: [3, 3], width: 1 },
          data: [...new Set(eventos.map(chave))].map((x) => ({ xAxis: x })) } },
    ],
  }));
  return true;
}

function graficoPib(destino, g) {
  if (!D.pib.some((p) => p[2] === g.id)) return false;
  const c = cartaoGrafico(destino, "Crescimento do PIB", "% ao ano · barras em azul são os anos atribuídos a este governo");
  desenhar(c, "g-pib", () => ({
    ...base(),
    grid: { left: 40, right: 12, top: 12, bottom: 28 },
    tooltip: { ...dica(), trigger: "item",
      formatter: (p) => {
        const [ano, , gid] = D.pib[p.dataIndex];
        const extra = D.acontecimentos.filter((e) => Number(anoDe(e.data)) === ano).map((e) => `<br>◆ ${e.titulo}`).join("");
        return `${ano} · ${governo(gid)?.presidente ?? ""}<br><strong>${sinal(p.value)}%</strong>${extra}`;
      } },
    xAxis: { type: "category", data: D.pib.map((p) => String(p[0])), ...eixo() },
    yAxis: { type: "value", ...eixo(), axisLine: { show: false } },
    series: [{
      type: "bar", barCategoryGap: "20%",
      data: D.pib.map((p) => ({
        value: p[1],
        itemStyle: { color: p[2] === g.id ? cor("--serie-a") : cor("--historico"),
          borderRadius: p[1] >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] },
      })),
    }],
  }));
  return true;
}

// ---------- vista: um governo ----------
function montarLinhaTempo() {
  const linha = document.getElementById("linha-tempo");
  const sel = document.getElementById("sel-governo");
  const eras = [];
  for (const g of D.governos) {
    if (!eras.length || eras.at(-1).nome !== g.periodo_historico) eras.push({ nome: g.periodo_historico, gs: [] });
    eras.at(-1).gs.push(g);
  }
  linha.replaceChildren(...eras.map((era) => el("div", { class: "era" },
    el("span", { class: "era-nome" }, era.nome),
    el("div", { class: "era-chips" }, era.gs.map((g) =>
      el("button", { class: "chip", type: "button", "data-id": g.id, "aria-pressed": "false", onclick: () => (location.hash = `#/governo/${g.id}/${grupo}`) },
        nome(g), el("span", { class: "ano" }, anos(g))))))));
  sel.replaceChildren(...eras.map((era) => el("optgroup", { label: era.nome },
    era.gs.map((g) => el("option", { value: g.id }, rotulo(g))))));
  sel.addEventListener("change", () => (location.hash = `#/governo/${sel.value}/${grupo}`));
}

// Por que um governo não tem o indicador: a medição começa depois dele, ou não há dado nos seus anos.
function motivoSemInfo(ind, g) {
  const desde = desdeDe(ind);
  if (desde && !g.em_curso && Number(anoFim(g)) < Number(desde)) return `A medição começa em ${desde}.`;
  if (g.em_curso) return "Ainda não há dado divulgado para este mandato.";
  return "Não há medição para os anos deste mandato.";
}

function cartaoKpi(cfg, m, gid) {
  if (!m) {
    return el("div", { class: "kpi vazio" },
      el("span", { class: "kpi-rotulo" }, cfg.rotulo),
      el("span", { class: "kpi-valor" }, SEM_INFO),
      el("span", { class: "kpi-nota" }, motivoSemInfo(cfg.ind, governo(gid))));
  }
  const nota = m.cobertura === "parcial" ? `Série começa em ${mesCurto(m.primeiro_mes)}, depois da posse.` :
    (m.cobertura === "anual" && governo(gid).em_curso) ? "Mandato em curso: só anos já divulgados." :
    (cfg.anual && Number(anoFimM(m)) < Number(anoFim(governo(gid)))) ? `Último dado disponível: ${anoFimM(m)}.` : "";
  const t = tendencia(cfg, m, gid);
  return el("div", { class: `kpi${t ? ` ${t}` : ""}` },
    el("span", { class: "kpi-topo" }, el("span", { class: "kpi-rotulo" }, cfg.rotulo), seloTendencia(t, cfg)),
    el("span", { class: "kpi-valor" }, cfg.principal(m)),
    el("span", { class: "kpi-sub" }, cfg.sub(m)),
    nota ? el("span", { class: "kpi-nota" }, nota) : null);
}

function mostrarGoverno(id, gr) {
  const g = governo(id) ?? D.governos.at(-1);
  grupo = grupoDaRota(gr);
  abasGrupo(document.getElementById("g-abas"), (novo) => (location.hash = `#/governo/${g.id}/${novo}`));
  document.querySelectorAll(".chip").forEach((c) => {
    const ativo = c.dataset.id === g.id;
    c.setAttribute("aria-pressed", String(ativo));
    if (ativo) c.scrollIntoView({ block: "nearest", inline: "center" });
  });
  document.getElementById("sel-governo").value = g.id;
  document.getElementById("g-periodo").textContent = g.periodo_historico;
  document.getElementById("g-retrato").replaceChildren(retrato(g, "grande"));
  document.getElementById("g-nome").replaceChildren(nome(g), " ", el("span", { class: "anos-titulo" }, anos(g)));
  document.getElementById("g-partido").textContent = g.partido ? `Partido: ${g.partido}` : "";
  const credito = document.getElementById("g-credito");
  credito.hidden = !g.foto;
  if (g.foto) credito.replaceChildren("Foto: ", el("a", { href: g.pagina, target: "_blank", rel: "noopener" }, "Wikipédia"));
  document.getElementById("g-datas").textContent =
    `${dataLonga(g.inicio)} a ${g.em_curso ? "hoje" : dataLonga(g.fim)} · ${duracao(g.dias)}${g.em_curso ? " até agora" : ""}`;
  document.getElementById("g-obs").textContent = g.observacao;
  document.title = `${g.presidente} · Brasil por Governo`;

  const cartoes = cartoesDo(grupo);
  document.getElementById("g-kpis").replaceChildren(...cartoes.map((c) => cartaoKpi(c, metrica(g.id, c.ind), g.id)));
  const semDados = cartoes.every((c) => !metrica(g.id, c.ind));
  document.getElementById("g-legenda-cores").hidden = cartoes.every((c) => !tendencia(c, metrica(g.id, c.ind), g.id));
  const inicios = [...new Set(cartoes.map((c) => desdeDe(c.ind)).filter(Boolean))].sort();
  document.getElementById("g-cobertura").textContent = semDados
    ? `Não há medições oficiais destes indicadores para este período: as mais antigas começam em ${inicios[0]}.`
    : grupo === "dia" ? "Os dados sociais são anuais e saem com um ou dois anos de atraso. Cada ano conta para o governo que ocupou a maior parte dele." : "";

  const eventos = eventosDe(g.id);
  document.getElementById("g-eventos-cartao").hidden = !eventos.length;
  document.getElementById("g-eventos").replaceChildren(...listaEventos(eventos));
  const polemicas = D.polemicas.filter((p) => p.governo_id === g.id);
  document.getElementById("g-polemicas-cartao").hidden = !polemicas.length;
  document.getElementById("g-polemicas").replaceChildren(...listaEventos(polemicas));

  limparGraficos("g-");
  const destino = document.getElementById("g-graficos");
  destino.replaceChildren();
  if (grupo === "economia") graficoPib(destino, g);
  GRAFICOS_LINHA.filter((cfg) => cfg.grupo === grupo).forEach((cfg) => graficoHistorico(destino, cfg, g));
}

// ---------- vista: comparar ----------
const comparaveis = () => D.governos.filter((g) => CARTOES.some((c) => metrica(g.id, c.ind)));

function montarComparar() {
  const opcoes = () => comparaveis().map((g) =>
    el("option", { value: g.id }, rotulo(g)));
  const a = document.getElementById("sel-a");
  const b = document.getElementById("sel-b");
  a.replaceChildren(...opcoes());
  b.replaceChildren(...opcoes());
  const ir = () => (location.hash = `#/comparar/${a.value}/${b.value}/${grupo}`);
  a.addEventListener("change", ir);
  b.addEventListener("change", ir);
  document.getElementById("trocar").addEventListener("click", () => (location.hash = `#/comparar/${b.value}/${a.value}/${grupo}`));
}

// Transforma a série de um governo em pontos por mês de mandato.
function serieMandato(ind, gid, modo) {
  const pts = (D.series[ind] || []).filter((p) => p[2] === gid);
  if (!pts.length) return [];
  if (modo === "acumulado") { // IPCA mensal -> inflação acumulada desde a posse
    let f = 1;
    return pts.map((p) => { f *= 1 + p[1] / 100; return [p[3], (f - 1) * 100]; });
  }
  if (modo === "variacao") return pts.map((p) => [p[3], (p[1] / pts[0][1] - 1) * 100]);
  return pts.map((p) => [p[3], p[1]]);
}

const GRAFICOS_COMPARAR = [
  { ind: "ipca", grupo: "dia", modo: "acumulado", titulo: "Quanto os preços subiram desde a posse", unidade: "%" },
  { ind: "salario_real", grupo: "dia", modo: "variacao", titulo: "Salário mínimo real: variação desde a posse", unidade: "%" },
  { ind: "poder_compra", grupo: "dia", modo: "nivel", titulo: "Salário mínimo frente ao custo de vida", unidade: "% do necessário", casas: 0 },
  { ind: "renda", grupo: "dia", modo: "nivel", titulo: "Renda média do trabalhador", unidade: "R$ de hoje", casas: 0 },
  { ind: "desemprego", grupo: "dia", modo: "nivel", titulo: "Desemprego", unidade: "%" },
  { ind: "pobreza", grupo: "dia", modo: "nivel", titulo: "Pessoas na pobreza", unidade: "% da população", anual: true },
  { ind: "extrema_pobreza", grupo: "dia", modo: "nivel", titulo: "Pessoas na extrema pobreza", unidade: "% da população", anual: true },
  { ind: "saneamento", grupo: "dia", modo: "nivel", titulo: "Acesso a saneamento básico", unidade: "% da população", anual: true },
  { ind: "mortalidade_infantil", grupo: "dia", modo: "nivel", titulo: "Mortalidade infantil", unidade: "por mil nascidos vivos", anual: true },
  { ind: "expectativa_vida", grupo: "dia", modo: "nivel", titulo: "Expectativa de vida", unidade: "anos", anual: true },
  { ind: "homicidios", grupo: "dia", modo: "nivel", titulo: "Homicídios", unidade: "por 100 mil habitantes", anual: true },
  { ind: "analfabetismo", grupo: "dia", modo: "nivel", titulo: "Analfabetismo", unidade: "% de 15 anos ou mais", anual: true },
  { ind: "dolar", grupo: "economia", modo: "variacao", titulo: "Variação do dólar desde a posse", unidade: "%" },
  { ind: "selic", grupo: "economia", modo: "nivel", titulo: "Taxa Selic", unidade: "% a.a." },
  { ind: "divida", grupo: "economia", modo: "nivel", titulo: "Dívida líquida do setor público", unidade: "% do PIB" },
  { ind: "reservas", grupo: "economia", modo: "variacao", titulo: "Variação das reservas desde a posse", unidade: "%" },
];

function legendaAB(ga, gb) {
  return el("div", { class: "legenda" },
    el("span", {}, el("i", { style: `background:${cor("--serie-a")}` }), ga.presidente),
    el("span", {}, el("i", { style: `background:${cor("--serie-b")}` }), gb.presidente));
}

function mostrarComparar(idA, idB, gr) {
  grupo = grupoDaRota(gr);
  const lista = comparaveis();
  const ga = governo(idA) && lista.includes(governo(idA)) ? governo(idA) : lista.at(-2);
  const gb = governo(idB) && lista.includes(governo(idB)) ? governo(idB) : lista.at(-1);
  document.getElementById("sel-a").value = ga.id;
  document.getElementById("sel-b").value = gb.id;
  document.title = `${ga.presidente} x ${gb.presidente} · Brasil por Governo`;
  abasGrupo(document.getElementById("c-abas"), (novo) => (location.hash = `#/comparar/${ga.id}/${gb.id}/${novo}`));
  const cartoes = cartoesDo(grupo);

  const periodo = (g) => `${anos(g)} · ${duracao(g.dias)}`;
  const celula = (cfg, gid) => {
    const m = metrica(gid, cfg.ind);
    if (!m) return el("td", { class: "num vazio-celula" }, SEM_INFO);
    const t = tendencia(cfg, m, gid);
    return el("td", { class: `num${t ? ` ${t}` : ""}` }, el("span", { class: "valor" }, cfg.principal(m)),
      seloTendencia(t, cfg), el("span", { class: "sub" }, cfg.sub(m)));
  };
  // Terceira coluna: qual dos dois números do cartão é maior e por quanto, na unidade do indicador
  // (pontos percentuais, anos, reais...). Maior não quer dizer melhor.
  const maior = (cfg) => {
    const ma = metrica(ga.id, cfg.ind), mb = metrica(gb.id, cfg.ind);
    const va = ma && cfg.numero(ma), vb = mb && cfg.numero(mb);
    if (va == null || vb == null) return el("td", { class: "maior vazio-celula" }, "Sem comparação");
    const dif = Math.abs(va - vb);
    if (dif < 0.05) return el("td", { class: "maior" }, "Empate");
    const [g, lado] = va > vb ? [ga, "a"] : [gb, "b"];
    return el("td", { class: "maior" },
      el("span", { class: "vencedor" }, el("i", { class: `ponto ${lado}`, "aria-hidden": "true" }), nome(g)),
      el("span", { class: "sub" }, (cfg.dif ?? pp)(dif)));
  };
  const cabeca = (g, lado) => el("th", { class: `num ${lado}` },
    el("span", { class: "cabeca-governo" }, retrato(g, "mini"), el("span", {}, nome(g),
      el("span", { class: "sub" }, `${periodo(g)}${g.partido ? ` · ${g.partido}` : ""}`))));
  document.getElementById("tab-comparar").replaceChildren(
    el("thead", {}, el("tr", {},
      el("th", {}, "Indicador"), cabeca(ga, "a"), cabeca(gb, "b"),
      el("th", { class: "maior" }, "Maior número", el("span", { class: "sub" }, "e a diferença")))),
    el("tbody", {}, cartoes.map((cfg) => el("tr", {}, el("td", {}, cfg.rotulo), celula(cfg, ga.id), celula(cfg, gb.id), maior(cfg)))));

  document.getElementById("c-eventos").replaceChildren(...[[ga, "a"], [gb, "b"]].map(([g, lado]) => {
    const ev = eventosDe(g.id);
    return el("div", { class: `cartao ${lado}` }, el("h2", {}, `Acontecimentos: ${g.presidente}`),
      ev.length ? el("ol", { class: "eventos-lista" }, listaEventos(ev)) : el("p", { class: "explica" }, "Nenhum acontecimento cadastrado."));
  }));

  limparGraficos("c-");
  const destino = document.getElementById("c-graficos");
  destino.replaceChildren();

  // PIB por ano de mandato
  const pibDe = (gid) => D.pib.filter((p) => p[2] === gid);
  const pa = pibDe(ga.id), pb = pibDe(gb.id);
  if (grupo === "economia" && (pa.length || pb.length)) {
    const n = Math.max(pa.length, pb.length);
    const c = cartaoGrafico(destino, "Crescimento do PIB por ano de mandato", "% ao ano");
    c.append(legendaAB(ga, gb));
    desenhar(c, "c-pib", () => ({
      ...base(),
      grid: { left: 40, right: 12, top: 12, bottom: 28 },
      tooltip: { ...dica(), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (ps) => `${ps[0].axisValue}<br>` + ps.map((p) => {
          const ano = (p.seriesIndex === 0 ? pa : pb)[p.dataIndex]?.[0];
          return p.value == null ? "" : `${p.marker}${p.seriesName} (${ano}): <strong>${sinal(p.value)}%</strong>`;
        }).filter(Boolean).join("<br>") },
      xAxis: { type: "category", data: Array.from({ length: n }, (_, i) => `${i + 1}º ano`), ...eixo() },
      yAxis: { type: "value", ...eixo(), axisLine: { show: false } },
      series: [[ga, pa, "--serie-a"], [gb, pb, "--serie-b"]].map(([g, pts, c]) => ({
        name: g.presidente, type: "bar", barGap: "10%", barCategoryGap: "30%",
        data: Array.from({ length: n }, (_, i) => pts[i]?.[1] ?? null),
        itemStyle: { color: cor(c), borderRadius: 3 },
      })),
    }), 240);
  }

  for (const cfg of GRAFICOS_COMPARAR.filter((c) => c.grupo === grupo)) {
    const sa = serieMandato(cfg.ind, ga.id, cfg.modo);
    const sb = serieMandato(cfg.ind, gb.id, cfg.modo);
    if (!sa.length && !sb.length) continue;
    const faltando = !sa.length ? ga : !sb.length ? gb : null;
    const c = cartaoGrafico(destino, cfg.titulo,
      `${cfg.unidade} · ${cfg.anual ? "um ponto por ano" : "eixo horizontal em meses"} desde a posse${faltando ? ` · ${SEM_INFO.toLowerCase()} para ${faltando.presidente}` : ""}`);
    c.append(legendaAB(ga, gb));
    desenhar(c, `c-${cfg.ind}`, () => ({
      ...base(),
      grid: { left: 48, right: 16, top: 12, bottom: 32 },
      tooltip: { ...dica(), trigger: "axis", axisPointer: { type: "line", lineStyle: { color: cor("--historico") } },
        formatter: (ps) => (cfg.anual ? `${ps[0].value[0] / 12 + 1}º ano do mandato<br>` : `Mês ${ps[0].value[0]} do mandato<br>`) +
          ps.map((p) => `${p.marker}${p.seriesName}: <strong>${fmt(p.value[1], cfg.casas ?? 1)}</strong> ${cfg.unidade}`).join("<br>") },
      xAxis: { type: "value", min: 0, ...eixo(), splitLine: { show: false },
        axisLabel: { ...eixo().axisLabel, formatter: (v) => (v === 0 ? "posse" : v % 12 === 0 ? `${v / 12} ${v === 12 ? "ano" : "anos"}` : "") }, interval: 12 },
      yAxis: { type: "value", scale: cfg.modo === "nivel", ...eixo(), axisLine: { show: false } },
      series: [[ga, sa, "--serie-a"], [gb, sb, "--serie-b"]].map(([g, pts, c]) => ({
        name: g.presidente, type: "line", data: pts, showSymbol: !!cfg.anual, symbolSize: 7,
        lineStyle: { width: 2.5, color: cor(c) }, itemStyle: { color: cor(c) },
      })),
    }));
  }
}

// ---------- vista: todos ----------
// Na tabela, os indicadores de nível mostram o último valor do mandato.
const fim = (m) => m.valor_fim;
const COLUNAS_TODOS = [
  { grupo: "dia", titulo: "Preços (% a.a.)", ind: "ipca", valor: (m) => m.media_anual, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Salário mínimo real (var. %)", ind: "salario_real", valor: (m) => m.variacao_pct, f: (v) => sinal(v) },
  { grupo: "dia", titulo: "Mínimo / necessário (%)", ind: "poder_compra", valor: fim, f: (v) => fmt(v, 0) },
  { grupo: "dia", titulo: "Renda média (R$)", ind: "renda", valor: fim, f: (v) => fmt(v, 0) },
  { grupo: "dia", titulo: "Desemprego (%)", ind: "desemprego", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Pobreza (%)", ind: "pobreza", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Extrema pobreza (%)", ind: "extrema_pobreza", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Saneamento (%)", ind: "saneamento", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Mortalidade infantil (por mil)", ind: "mortalidade_infantil", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Expectativa de vida (anos)", ind: "expectativa_vida", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Homicídios (por 100 mil)", ind: "homicidios", valor: fim, f: (v) => fmt(v) },
  { grupo: "dia", titulo: "Analfabetismo (%)", ind: "analfabetismo", valor: fim, f: (v) => fmt(v) },
  { grupo: "economia", titulo: "PIB (% a.a.)", ind: "pib", valor: (m) => m.media, f: (v) => sinal(v) },
  { grupo: "economia", titulo: "Dólar (var. %)", ind: "dolar", valor: (m) => m.variacao_pct, f: (v) => sinal(v) },
  { grupo: "economia", titulo: "Selic média (%)", ind: "selic", valor: (m) => m.media, f: (v) => fmt(v) },
  { grupo: "economia", titulo: "Dívida (p.p. do PIB)", ind: "divida", valor: (m) => m.variacao_pp, f: (v) => sinal(v) },
  { grupo: "economia", titulo: "Reservas (var. %)", ind: "reservas", valor: (m) => m.variacao_pct, f: (v) => sinal(v) },
];
let ordemTodos = { col: -1, dir: 1 };

function mostrarTodos(gr) {
  const trocou = grupo !== grupoDaRota(gr);
  grupo = grupoDaRota(gr);
  if (trocou) ordemTodos = { col: -1, dir: 1 };
  abasGrupo(document.getElementById("t-abas"), (novo) => (location.hash = `#/todos/${novo}`));
  const COLUNAS = COLUNAS_TODOS.filter((c) => c.grupo === grupo && D.indicadores[baseDe(c.ind)]);
  const linhas = D.governos.map((g) => ({
    g, vals: COLUNAS.map((c) => { const m = metrica(g.id, c.ind); return m ? c.valor(m) : null; }),
  }));
  if (ordemTodos.col >= 0) {
    const i = ordemTodos.col;
    linhas.sort((x, y) => (x.vals[i] == null) - (y.vals[i] == null) || ordemTodos.dir * (x.vals[i] - y.vals[i]));
  } else if (ordemTodos.dir === -1) {
    linhas.reverse();
  }
  const ordenar = (i) => () => {
    ordemTodos = { col: i, dir: ordemTodos.col === i ? -ordemTodos.dir : (i < 0 ? 1 : -1) };
    mostrarTodos(grupo);
  };
  const sortAttr = (i) => (ordemTodos.col === i ? (ordemTodos.dir === 1 ? "ascending" : "descending") : "none");
  document.getElementById("tab-todos").replaceChildren(
    el("thead", {}, el("tr", {},
      el("th", { "aria-sort": sortAttr(-1), onclick: ordenar(-1) }, "Governo"),
      COLUNAS.map((c, i) => el("th", { class: "num", "aria-sort": sortAttr(i), onclick: ordenar(i) }, c.titulo)))),
    el("tbody", {}, linhas.map(({ g, vals }) => el("tr", { onclick: () => (location.hash = `#/governo/${g.id}/${grupo}`) },
      el("td", {}, nome(g), el("span", { class: "sub" }, [anos(g), g.partido].filter(Boolean).join(" · "))),
      vals.map((v, i) => v == null ? el("td", { class: "num vazio-celula sem-info" }, SEM_INFO)
        : el("td", { class: "num" }, COLUNAS[i].f(v)))))));
}

// ---------- vista: sobre ----------
function montarSobre() {
  const fonte = (c) => c.ipea ? [` Fonte: ${c.fonte}, série ${c.ipea} no `, el("a", { href: "http://www.ipeadata.gov.br" }, "Ipeadata"), "."]
    : c.bm ? [` Fonte: ${c.fonte}, indicador `, el("a", { href: `https://data.worldbank.org/indicator/${c.bm}?locations=BR` }, c.bm), "."]
    : c.dieese ? [" Fonte: ", el("a", { href: "https://www.dieese.org.br/analisecestabasica/salarioMinimo.html" }, "DIEESE"), "."] : "";
  document.getElementById("lista-fontes").replaceChildren(...Object.entries(GRUPOS).flatMap(([gr, titulo]) => [
    el("li", { class: "fontes-grupo" }, el("strong", {}, titulo)),
    ...Object.values(D.indicadores).filter((c) => c.grupo === gr).map((c) =>
      el("li", {}, el("strong", {}, `${c.nome}: `), c.nota, fonte(c)))]));
  document.getElementById("gerado-em").textContent = `Dados atualizados em ${dataLonga(D.meta.gerado_em)}.`;
}

// ---------- rotas ----------
function rotear() {
  const [, aba = "governo", ...args] = location.hash.split("/");
  document.querySelectorAll(".vista").forEach((v) => (v.hidden = v.id !== `vista-${aba}`));
  document.querySelectorAll(".abas a").forEach((a) => a.classList.toggle("ativa", a.dataset.aba === aba));
  if (aba === "governo") mostrarGoverno(args[0], args[1]);
  else if (aba === "comparar") mostrarComparar(args[0], args[1], args[2]);
  else if (aba === "todos") mostrarTodos(args[0]);
  else if (!document.getElementById(`vista-${aba}`)) { location.hash = "#/governo"; return; }
  window.scrollTo({ top: 0 });
}

async function main() {
  const nomes = ["governos", "acontecimentos", "polemicas", "metricas", "series", "pib", "indicadores", "meta"];
  const dados = await Promise.all(nomes.map((n) => fetch(`data/${n}.json`).then((r) => r.json())));
  nomes.forEach((n, i) => (D[n] = dados[i]));

  document.getElementById("aviso-amostra").hidden = !D.meta.amostra_sintetica;
  montarLinhaTempo();
  montarComparar();
  montarSobre();
  window.addEventListener("hashchange", rotear);
  rotear();

  window.addEventListener("resize", () => graficos.forEach(({ g }) => g.resize()));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rotear);
}

main();
