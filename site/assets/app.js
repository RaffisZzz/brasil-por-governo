// Brasil por Governo: lê os JSON de site/data/ (gerados por etl/export_site.py) e monta as três vistas.

const D = {}; // governos, metricas, series, pib, indicadores, meta
const graficos = new Map(); // id do elemento -> { g, opcoes }

// ---------- formatação ----------
const nf = (casas) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
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
const anos = (g) => `${anoDe(g.inicio)}–${anoFim(g)}`;
const rotulo = (g) => (g.presidente.includes("(") ? g.presidente : `${g.presidente} (${anos(g)})`);

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
      el("span", { class: "evento-titulo" }, e.titulo), el("span", { class: "tag" }, e.categoria),
      el("p", { class: "evento-desc" }, e.descricao))));
}
const metrica = (gid, ind) => D.metricas.find((m) => m.governo_id === gid && m.indicador === ind);

// ---------- o que cada cartão mostra ----------
// principal/sub recebem a linha de metricas.json; "vazio" explica a ausência de série.
const CARTOES = [
  {
    ind: "pib", rotulo: "Crescimento do PIB",
    principal: (m) => `${sinal(m.media)}% ao ano`,
    sub: (m) => `${sinal(m.acumulado)}% no total, em ${m.meses} ${m.meses === 1 ? "ano" : "anos"}`,
    numero: (m) => m.media,
  },
  {
    ind: "ipca", rotulo: "Inflação (IPCA)",
    principal: (m) => `${fmt(m.media_anual)}% ao ano`,
    sub: (m) => `${fmt(m.acumulado)}% acumulada no mandato`,
    numero: (m) => m.media_anual,
  },
  {
    ind: "dolar", rotulo: "Dólar",
    principal: (m) => `${sinal(m.variacao_pct)}%`,
    sub: (m) => `de R$ ${fmt(m.valor_inicio, 2)} para R$ ${fmt(m.valor_fim, 2)}`,
    numero: (m) => m.variacao_pct,
  },
  {
    ind: "selic", rotulo: "Taxa Selic",
    principal: (m) => `${fmt(m.media)}% ao ano`,
    sub: (m) => `média do mandato; de ${fmt(m.valor_inicio)}% para ${fmt(m.valor_fim)}%`,
    numero: (m) => m.media,
  },
  {
    ind: "desemprego", rotulo: "Desemprego",
    principal: (m) => `${sinal(m.variacao_pp)} p.p.`,
    sub: (m) => `de ${fmt(m.valor_inicio)}% para ${fmt(m.valor_fim)}%`,
    numero: (m) => m.variacao_pp,
  },
  {
    ind: "divida", rotulo: "Dívida líquida do setor público",
    principal: (m) => `${sinal(m.variacao_pp)} p.p. do PIB`,
    sub: (m) => `de ${fmt(m.valor_inicio)}% para ${fmt(m.valor_fim)}% do PIB`,
    numero: (m) => m.variacao_pp,
  },
  {
    ind: "salario_real", rotulo: "Salário mínimo real",
    principal: (m) => `${sinal(m.variacao_pct)}%`,
    sub: (m) => `de R$ ${fmt(m.valor_inicio, 0)} para R$ ${fmt(m.valor_fim, 0)} (em reais de hoje)`,
    numero: (m) => m.variacao_pct,
  },
  {
    ind: "reservas", rotulo: "Reservas internacionais",
    principal: (m) => `${sinal(m.variacao_pct)}%`,
    sub: (m) => `de US$ ${fmt(m.valor_inicio / 1000, 1)} bi para US$ ${fmt(m.valor_fim / 1000, 1)} bi`,
    numero: (m) => m.variacao_pct,
  },
];
const desdeDe = (ind) => {
  const base = ind === "salario_real" ? "salario_minimo" : ind;
  return D.indicadores[base]?.desde?.slice(0, 4);
};

// ---------- gráficos ----------
function desenhar(container, id, opcoes, altura = 260) {
  const div = el("div", { id, class: "grafico", role: "img" });
  div.style.height = `${altura}px`;
  container.append(div);
  const g = echarts.init(div, null, { renderer: "svg" });
  g.setOption(opcoes());
  graficos.set(id, { g, opcoes });
}
function limparGraficos(prefixo) {
  for (const [id, { g }] of graficos) {
    if (id.startsWith(prefixo)) { g.dispose(); graficos.delete(id); }
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

const GRAFICOS_LINHA = [
  { ind: "ipca_12m", titulo: "Inflação em 12 meses", unidade: "%", casas: 1 },
  { ind: "dolar", titulo: "Dólar", unidade: "R$", casas: 2 },
  { ind: "selic", titulo: "Taxa Selic", unidade: "% a.a.", casas: 1 },
  { ind: "desemprego", titulo: "Desemprego", unidade: "%", casas: 1 },
  { ind: "divida", titulo: "Dívida líquida do setor público", unidade: "% do PIB", casas: 1 },
  { ind: "salario_real", titulo: "Salário mínimo real", unidade: "R$ de hoje", casas: 0 },
  { ind: "reservas", titulo: "Reservas internacionais", unidade: "US$ bi", casas: 1, escala: 1 / 1000 },
];

function graficoHistorico(destino, cfg, g) {
  const serie = D.series[cfg.ind] || [];
  if (!serie.some((p) => p[2] === g.id)) return false;
  const k = cfg.escala ?? 1;
  const meses = serie.map((p) => p[0]);
  const todos = serie.map((p) => p[1] * k);
  const mandato = serie.map((p) => (p[2] === g.id ? p[1] * k : null));
  const quem = serie.map((p) => governo(p[2])?.presidente ?? "");
  const iniMandato = meses.findIndex((_, i) => serie[i][2] === g.id);
  const fimMandato = meses.length - 1 - [...serie].reverse().findIndex((p) => p[2] === g.id);
  // Janela inicial: o mandato com até 4 anos de contexto de cada lado.
  const ini = Math.max(0, iniMandato - 48);
  const fim = Math.min(meses.length - 1, fimMandato + 48);

  // Acontecimentos do mandato com precisão de dia ou mês viram linhas verticais no gráfico.
  const eventos = eventosDe(g.id).filter((e) => e.precisao !== "ano" && meses.includes(e.data.slice(0, 7)));
  const eventosNoMes = (ym) => eventos.filter((e) => e.data.slice(0, 7) === ym);

  const c = cartaoGrafico(destino, cfg.titulo, `${cfg.unidade} · arraste a barra de baixo para ver outros períodos`);
  desenhar(c, `g-${cfg.ind}`, () => ({
    ...base(),
    grid: { left: 48, right: 16, top: 12, bottom: 64 },
    tooltip: {
      ...dica(), trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: cor("--historico") } },
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        const extra = eventosNoMes(meses[i]).map((e) => `<br>◆ ${e.titulo}`).join("");
        return `${mesCurto(meses[i])} · ${quem[i]}<br><strong>${fmt(todos[i], cfg.casas)}</strong> ${cfg.unidade}${extra}`;
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
      { name: "Histórico", type: "line", data: todos, showSymbol: false, lineStyle: { width: 1.5, color: cor("--historico") },
        itemStyle: { color: cor("--historico") },
        markArea: { silent: true, itemStyle: { color: cor("--faixa") }, data: [[{ xAxis: meses[iniMandato] }, { xAxis: meses[fimMandato] }]] } },
      { name: g.presidente, type: "line", data: mandato, showSymbol: false, connectNulls: false,
        lineStyle: { width: 2.5, color: cor("--serie-a") }, itemStyle: { color: cor("--serie-a") },
        markLine: { silent: true, symbol: "none", label: { show: false },
          lineStyle: { color: cor("--text-muted"), type: [3, 3], width: 1 },
          data: eventos.map((e) => ({ xAxis: e.data.slice(0, 7) })) } },
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
      el("button", { class: "chip", type: "button", "data-id": g.id, "aria-pressed": "false", onclick: () => (location.hash = `#/governo/${g.id}`) },
        g.presidente.replace(/ \(.*\)$/, ""), el("span", { class: "ano" }, anoDe(g.inicio))))))));
  sel.replaceChildren(...eras.map((era) => el("optgroup", { label: era.nome },
    era.gs.map((g) => el("option", { value: g.id }, rotulo(g))))));
  sel.addEventListener("change", () => (location.hash = `#/governo/${sel.value}`));
}

function cartaoKpi(cfg, m, gid) {
  if (!m) {
    const desde = desdeDe(cfg.ind);
    return el("div", { class: "kpi vazio" },
      el("span", { class: "kpi-rotulo" }, cfg.rotulo),
      el("span", { class: "kpi-valor" }, "Sem dados"),
      el("span", { class: "kpi-nota" }, desde ? `Série oficial comparável começa em ${desde}.` : "Sem série oficial para o período."));
  }
  const nota = m.cobertura === "parcial" ? `Série começa em ${mesCurto(m.primeiro_mes)}, depois da posse.` :
    (cfg.ind === "pib" && governo(gid).em_curso) ? "Mandato em curso: só anos já divulgados." : "";
  return el("div", { class: "kpi" },
    el("span", { class: "kpi-rotulo" }, cfg.rotulo),
    el("span", { class: "kpi-valor" }, cfg.principal(m)),
    el("span", { class: "kpi-sub" }, cfg.sub(m)),
    nota ? el("span", { class: "kpi-nota" }, nota) : null);
}

function mostrarGoverno(id) {
  const g = governo(id) ?? D.governos.at(-1);
  document.querySelectorAll(".chip").forEach((c) => {
    const ativo = c.dataset.id === g.id;
    c.setAttribute("aria-pressed", String(ativo));
    if (ativo) c.scrollIntoView({ block: "nearest", inline: "center" });
  });
  document.getElementById("sel-governo").value = g.id;
  document.getElementById("g-periodo").textContent = g.periodo_historico;
  document.getElementById("g-nome").textContent = g.presidente;
  document.getElementById("g-datas").textContent =
    `${dataLonga(g.inicio)} a ${g.em_curso ? "hoje" : dataLonga(g.fim)} · ${duracao(g.dias)}${g.em_curso ? " até agora" : ""}`;
  document.getElementById("g-obs").textContent = g.observacao;
  document.title = `${g.presidente} · Brasil por Governo`;

  document.getElementById("g-kpis").replaceChildren(...CARTOES.map((c) => cartaoKpi(c, metrica(g.id, c.ind), g.id)));
  const semDados = CARTOES.every((c) => !metrica(g.id, c.ind));
  document.getElementById("g-cobertura").textContent = semDados
    ? "Não há séries oficiais comparáveis para este período. Os indicadores começam em 1901 (PIB), 1980 (inflação) e 1994 (dólar, juros e salário mínimo)."
    : "";

  const eventos = eventosDe(g.id);
  document.getElementById("g-eventos-cartao").hidden = !eventos.length;
  document.getElementById("g-eventos").replaceChildren(...listaEventos(eventos));

  limparGraficos("g-");
  const destino = document.getElementById("g-graficos");
  destino.replaceChildren();
  graficoPib(destino, g);
  GRAFICOS_LINHA.forEach((cfg) => graficoHistorico(destino, cfg, g));
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
  const ir = () => (location.hash = `#/comparar/${a.value}/${b.value}`);
  a.addEventListener("change", ir);
  b.addEventListener("change", ir);
  document.getElementById("trocar").addEventListener("click", () => (location.hash = `#/comparar/${b.value}/${a.value}`));
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
  { ind: "ipca", modo: "acumulado", titulo: "Inflação acumulada desde a posse", unidade: "%" },
  { ind: "dolar", modo: "variacao", titulo: "Variação do dólar desde a posse", unidade: "%" },
  { ind: "selic", modo: "nivel", titulo: "Taxa Selic", unidade: "% a.a." },
  { ind: "desemprego", modo: "nivel", titulo: "Desemprego", unidade: "%" },
  { ind: "salario_real", modo: "variacao", titulo: "Variação do salário mínimo real desde a posse", unidade: "%" },
  { ind: "divida", modo: "nivel", titulo: "Dívida líquida do setor público", unidade: "% do PIB" },
  { ind: "reservas", modo: "variacao", titulo: "Variação das reservas desde a posse", unidade: "%" },
];

function legendaAB(ga, gb) {
  return el("div", { class: "legenda" },
    el("span", {}, el("i", { style: `background:${cor("--serie-a")}` }), ga.presidente),
    el("span", {}, el("i", { style: `background:${cor("--serie-b")}` }), gb.presidente));
}

function mostrarComparar(idA, idB) {
  const lista = comparaveis();
  const ga = governo(idA) && lista.includes(governo(idA)) ? governo(idA) : lista.at(-2);
  const gb = governo(idB) && lista.includes(governo(idB)) ? governo(idB) : lista.at(-1);
  document.getElementById("sel-a").value = ga.id;
  document.getElementById("sel-b").value = gb.id;
  document.title = `${ga.presidente} x ${gb.presidente} · Brasil por Governo`;

  const periodo = (g) => `${anos(g)} · ${duracao(g.dias)}`;
  const celula = (cfg, gid) => {
    const m = metrica(gid, cfg.ind);
    if (!m) return el("td", { class: "num vazio-celula" }, "sem dados");
    return el("td", { class: "num" }, cfg.principal(m), el("span", { class: "sub" }, cfg.sub(m)));
  };
  document.getElementById("tab-comparar").replaceChildren(
    el("thead", {}, el("tr", {},
      el("th", {}, "Indicador"),
      el("th", { class: "num a" }, ga.presidente, el("span", { class: "sub" }, periodo(ga))),
      el("th", { class: "num b" }, gb.presidente, el("span", { class: "sub" }, periodo(gb))))),
    el("tbody", {}, CARTOES.map((cfg) => el("tr", {}, el("td", {}, cfg.rotulo), celula(cfg, ga.id), celula(cfg, gb.id)))));

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
  if (pa.length || pb.length) {
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

  for (const cfg of GRAFICOS_COMPARAR) {
    const sa = serieMandato(cfg.ind, ga.id, cfg.modo);
    const sb = serieMandato(cfg.ind, gb.id, cfg.modo);
    if (!sa.length && !sb.length) continue;
    const faltando = !sa.length ? ga : !sb.length ? gb : null;
    const c = cartaoGrafico(destino, cfg.titulo,
      `${cfg.unidade} · eixo horizontal em meses desde a posse${faltando ? ` · sem dados para ${faltando.presidente}` : ""}`);
    c.append(legendaAB(ga, gb));
    desenhar(c, `c-${cfg.ind}`, () => ({
      ...base(),
      grid: { left: 48, right: 16, top: 12, bottom: 32 },
      tooltip: { ...dica(), trigger: "axis", axisPointer: { type: "line", lineStyle: { color: cor("--historico") } },
        formatter: (ps) => `Mês ${ps[0].value[0]} do mandato<br>` +
          ps.map((p) => `${p.marker}${p.seriesName}: <strong>${fmt(p.value[1], 1)}</strong> ${cfg.unidade}`).join("<br>") },
      xAxis: { type: "value", min: 0, ...eixo(), splitLine: { show: false },
        axisLabel: { ...eixo().axisLabel, formatter: (v) => (v === 0 ? "posse" : v % 12 === 0 ? `${v / 12} ${v === 12 ? "ano" : "anos"}` : "") }, interval: 12 },
      yAxis: { type: "value", scale: cfg.modo === "nivel", ...eixo(), axisLine: { show: false } },
      series: [[ga, sa, "--serie-a"], [gb, sb, "--serie-b"]].map(([g, pts, c]) => ({
        name: g.presidente, type: "line", data: pts, showSymbol: false,
        lineStyle: { width: 2.5, color: cor(c) }, itemStyle: { color: cor(c) },
      })),
    }));
  }
}

// ---------- vista: todos ----------
const COLUNAS_TODOS = [
  { titulo: "PIB (% a.a.)", ind: "pib", valor: (m) => m.media, f: (v) => sinal(v) },
  { titulo: "Inflação (% a.a.)", ind: "ipca", valor: (m) => m.media_anual, f: (v) => fmt(v) },
  { titulo: "Dólar (var. %)", ind: "dolar", valor: (m) => m.variacao_pct, f: (v) => sinal(v) },
  { titulo: "Selic média (%)", ind: "selic", valor: (m) => m.media, f: (v) => fmt(v) },
  { titulo: "Desemprego (p.p.)", ind: "desemprego", valor: (m) => m.variacao_pp, f: (v) => sinal(v) },
  { titulo: "Dívida (p.p. do PIB)", ind: "divida", valor: (m) => m.variacao_pp, f: (v) => sinal(v) },
  { titulo: "Salário real (var. %)", ind: "salario_real", valor: (m) => m.variacao_pct, f: (v) => sinal(v) },
];
let ordemTodos = { col: -1, dir: 1 };

function mostrarTodos() {
  const linhas = D.governos.map((g) => ({
    g, vals: COLUNAS_TODOS.map((c) => { const m = metrica(g.id, c.ind); return m ? c.valor(m) : null; }),
  }));
  if (ordemTodos.col >= 0) {
    const i = ordemTodos.col;
    linhas.sort((x, y) => (x.vals[i] == null) - (y.vals[i] == null) || ordemTodos.dir * (x.vals[i] - y.vals[i]));
  } else if (ordemTodos.dir === -1) {
    linhas.reverse();
  }
  const ordenar = (i) => () => {
    ordemTodos = { col: i, dir: ordemTodos.col === i ? -ordemTodos.dir : (i < 0 ? 1 : -1) };
    mostrarTodos();
  };
  const sortAttr = (i) => (ordemTodos.col === i ? (ordemTodos.dir === 1 ? "ascending" : "descending") : "none");
  document.getElementById("tab-todos").replaceChildren(
    el("thead", {}, el("tr", {},
      el("th", { "aria-sort": sortAttr(-1), onclick: ordenar(-1) }, "Governo"),
      COLUNAS_TODOS.map((c, i) => el("th", { class: "num", "aria-sort": sortAttr(i), onclick: ordenar(i) }, c.titulo)))),
    el("tbody", {}, linhas.map(({ g, vals }) => el("tr", { onclick: () => (location.hash = `#/governo/${g.id}`) },
      el("td", {}, g.presidente, el("span", { class: "sub" }, anos(g))),
      vals.map((v, i) => el("td", { class: `num${v == null ? " vazio-celula" : ""}` }, v == null ? "–" : COLUNAS_TODOS[i].f(v)))))));
}

// ---------- vista: sobre ----------
function montarSobre() {
  document.getElementById("lista-fontes").replaceChildren(...Object.values(D.indicadores).map((c) =>
    el("li", {}, el("strong", {}, `${c.nome}: `), c.nota,
      c.ipea ? [` Fonte: ${c.fonte}, série ${c.ipea} no `, el("a", { href: "http://www.ipeadata.gov.br" }, "Ipeadata"), "."] : "")));
  document.getElementById("gerado-em").textContent = `Dados atualizados em ${dataLonga(D.meta.gerado_em)}.`;
}

// ---------- rotas ----------
function rotear() {
  const [, aba = "governo", ...args] = location.hash.split("/");
  document.querySelectorAll(".vista").forEach((v) => (v.hidden = v.id !== `vista-${aba}`));
  document.querySelectorAll(".abas a").forEach((a) => a.classList.toggle("ativa", a.dataset.aba === aba));
  if (aba === "governo") mostrarGoverno(args[0]);
  else if (aba === "comparar") mostrarComparar(args[0], args[1]);
  else if (aba === "todos") mostrarTodos();
  else if (!document.getElementById(`vista-${aba}`)) { location.hash = "#/governo"; return; }
  window.scrollTo({ top: 0 });
}

async function main() {
  const nomes = ["governos", "acontecimentos", "metricas", "series", "pib", "indicadores", "meta"];
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
