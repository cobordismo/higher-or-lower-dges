// ================== Dados ==================
// DADOS vem de data.js: { i: [instituições], c: [[idxInst, curso, grau, nota, vagas, colocados], ...] }
const semAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const REGIOES = [
  ["Açores e Madeira", /acores|madeira/],
  ["Algarve", /algarve/],
  ["Alentejo", /evora|beja|portalegre/],
  ["Lisboa e Vale do Tejo", /lisboa|iscte|setubal|santarem|estoril|nautica/],
  ["Centro", /coimbra|aveiro|leiria|viseu|guarda|castelo branco|beira interior|tomar/],
  ["Norte", /porto|minho|braga|braganca|tras-os-montes|viana do castelo|cavado/],
];

// A primeira regra que corresponde decide a área (a ordem importa).
const AREAS = [
  ["Engenharia e Tecnologia", /engenh|informatic|computa|software|dados|inteligencia artificial|tecnologias (digitais|de informa|de energia|do petroleo|e desenvolvimento web|e design de multimedia)|informatica|telecomunica|eletroni|eletromec|mecatron|mecanica|automacao|redes e sistemas|sistemas (de|e) (informa|tecnologias)|seguranca informatica|jogos digitais|construcao digital|energia e ambiente|pilotagem|bioengenharia|(^| )tecnologia (quimica|agro|alimentar|e gestao industrial)|quimica (industrial|tecnologica)|gestao industrial|seguranca do trabalho|gestao da edificacao|tecnologias do ambiente/],
  ["Educação e Desporto", /desport|educacao|atividade fisica|treino|animacao socioeducativa|tecnologias para a educacao/],
  ["Saúde", /medicin|enfermagem|farmac|fisioterap|nutricao|dietetica|terapia|fisiologia clinica|radioterap|imagem medica|biomedic|ortopt|optometr|audiolog|protese dentaria|higiene oral|saude|osteopat|ortoprot|gerontolog|veterinar|reabilitacao psicomotora|psicomotricidade/],
  ["Economia, Gestão e Turismo", /turis|assessoria de direcao/],
  ["Línguas e Humanidades", /lingua|tradu|literatura|portugues|historia|filosof|arqueolog|classicos|estudos (portug|culturais|de cultura|comparat|orientais|africanos|asiaticos|gerais)|humanidades|editoriais|gestual|ciencias da cultura|cultura e transformacao|patrimonio cultural$|patrimonio cultural e|lusofon/],
  ["Direito e Ciências Sociais", /direito|solicitad|criminolog|politic|relacoes internacionais|estudos (europeus|internacionais)|sociolog|antropolog|psicolog|servico social|ciencias sociais|geograf|planeamento|territorio|relacoes humanas|animacao sociocultural|protecao civil|cidades|educacao social|ciencia da informacao|documentacao/],
  ["Artes, Design e Comunicação", /^comunicacao|jornalismo|relacoes publicas|artistic/],
  ["Economia, Gestão e Turismo", /econom|gest|contab|financ|fiscal|marketing|turis|hotel|negocios|comercio|empresa|administracao|secretariad|recursos humanos|logistic|restaura|gastronom|eventos|auditoria|catering|portuaria/],
  ["Artes, Design e Comunicação", /arte|design|musica|musicais|teatro|danca|cinema|multimedia|audiovisual|fotografia|pintura|escultura|desenho|comunicacao|jornalismo|publicidade|relacoes publicas|media|som e imagem|imagem animada|arquitetura|conservacao|moda|mobiliario|programacao e producao cultural|mediacao artistica|performativ/],
  ["Ciências e Ambiente", /./],
];

const regiaoDe = (inst) => (REGIOES.find(([, re]) => re.test(semAcentos(inst))) || ["Outra"])[0];
const areaDe = (curso) => AREAS.find(([, re]) => re.test(semAcentos(curso.replace(/\s*\(.*?\)\s*/g, " "))))[0];
const tipoDe = (inst) => (/^(Universidade|ISCTE)/.test(inst) ? "Universidades" : "Politécnicos");

const CURSOS = DADOS.c.map(([idx, curso, grau, nota, vagas, colocados], id) => {
  const nomeInst = DADOS.i[idx];
  const [inst, ...resto] = nomeInst.split(" - ");
  return {
    id, curso, grau, nota, vagas, colocados, inst,
    escola: resto.join(" - "),
    area: areaDe(curso),
    regiao: regiaoDe(inst),
    tipo: tipoDe(inst),
  };
});

const GRAUS = { L1: "Licenciatura", MI: "Mestrado Integrado" };

// ================== Modos ==================
// O primeiro modo é o principal: aparece em destaque e é o escolhido por omissão.
const MODOS = {
  relogio: {
    nome: "Contra-relógio", icone: "⏱", campo: "nota", tempo: 120, pistas: true,
    desc: "Notas · 120 s · errar −7 s · 5 seguidas +5 s",
    pergunta: "Rápido! O segundo curso tem nota mais alta ou mais baixa?",
    alta: "Mais alta", baixa: "Mais baixa", legenda: "nota do último colocado",
  },
  classico: {
    nome: "Clássico", icone: "🎓", campo: "nota", pistas: true,
    desc: "Notas · até errares",
    pergunta: "O segundo curso tem nota do último colocado mais alta ou mais baixa?",
    alta: "Mais alta", baixa: "Mais baixa", legenda: "nota do último colocado",
  },
  vagas: {
    nome: "Vagas", icone: "🪑", campo: "vagas",
    desc: "Vagas · até errares",
    pergunta: "O segundo curso tem mais ou menos vagas?",
    alta: "Mais vagas", baixa: "Menos vagas", legenda: "vagas iniciais",
  },
  "vagas-relogio": {
    nome: "Vagas contra-relógio", icone: "⏳", campo: "vagas", tempo: 60,
    desc: "Vagas · 60 s",
    pergunta: "Rápido! O segundo curso tem mais ou menos vagas?",
    alta: "Mais vagas", baixa: "Menos vagas", legenda: "vagas iniciais",
  },
};
const PENALIZACAO = 7, BONUS = 5, BONUS_CADA = 5;

// ================== Estado ==================
let modo = lerLS("hl-modo", "relogio");
if (!MODOS[modo]) modo = "relogio";
let filtros = { area: "", regiao: "", tipo: "" };
let pool = [], vistos = new Set();
let atual, proximo, pontos = 0, streak = 0, melhorStreakJogo = 0, aBloquear = false;
let recordeAntes = 0, tempoRestante = 0, timerId = null, fimTempo = 0, emJogo = false;
let ultimoErro = null, jogoSubmetido = false;

// migrar recorde da versão anterior
if (lerLS("hl-recorde", null) && !lerLS("hl-recorde-classico", null)) guardarLS("hl-recorde-classico", lerLS("hl-recorde", 0));

// ================== Elementos ==================
const $ = (s) => document.querySelector(s);
const ecras = { inicio: $("#ecra-inicio"), jogo: $("#ecra-jogo"), fim: $("#ecra-fim"), lb: $("#ecra-lb") };
const cartaoA = $("#cartao-a");
const cartaoB = $("#cartao-b");
const vs = $("#vs");
const botoes = document.querySelectorAll("#botoes .btn");

// ================== Utilitários ==================
function lerLS(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch { return def; } }
function guardarLS(k, v) { try { localStorage.setItem(k, v); } catch {} }
const recordeDe = (m) => Number(lerLS("hl-recorde-" + m, 0)) || 0;
const streakDe = (m) => Number(lerLS("hl-streak-" + m, 0)) || 0;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const temFiltros = () => Boolean(filtros.area || filtros.regiao || filtros.tipo);

function formatar(v, campo) {
  return campo === "nota" ? v.toFixed(1).replace(".", ",") : Math.round(v).toLocaleString("pt-PT");
}

function mostrarEcra(nome) {
  Object.values(ecras).forEach((e) => e.classList.remove("ativo"));
  ecras[nome].classList.add("ativo");
  window.scrollTo(0, 0);
}

function toast(txt, tipo = "") {
  const t = $("#toast");
  t.textContent = txt;
  t.className = "toast mostrar " + tipo;
  clearTimeout(toast._id);
  toast._id = setTimeout(() => (t.className = "toast"), 1100);
}

// ================== Nome do jogador ==================
const limparNome = (s) => s.trim().replace(/\s+/g, " ").slice(0, 20);
const nomeJogador = () => lerLS("hl-nome", "");

function mostrarNome(editar = false) {
  const nome = nomeJogador();
  const aEditar = editar || !nome;
  $("#form-jogador").hidden = !aEditar;
  $("#jogador-ola").hidden = aEditar;
  $("#jogador-nome").textContent = nome;
  $("#nome-jogador").value = nome;
  if (editar) $("#nome-jogador").focus();
}

function guardarNome(e) {
  e.preventDefault();
  const nome = limparNome($("#nome-jogador").value);
  if (!nome) { $("#nome-jogador").focus(); return; }
  guardarLS("hl-nome", nome);
  mostrarNome();
}

// ================== Ecrã inicial ==================
function construirModos() {
  const box = $("#modos");
  box.innerHTML = "";
  Object.entries(MODOS).forEach(([id, m], i) => {
    const b = document.createElement("button");
    b.className = "modo" + (i === 0 ? " destaque" : "");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.modo = id;
    b.innerHTML = `<span class="modo-icone" aria-hidden="true">${m.icone}</span>
      <span class="modo-texto"><span class="modo-nome">${m.nome}</span><span class="modo-desc">${m.desc}</span></span>`;
    b.addEventListener("click", () => { modo = id; guardarLS("hl-modo", id); atualizarInicio(); });
    box.appendChild(b);
  });
}

function construirFiltros() {
  const preencherSelect = (sel, titulo, valores) => {
    sel.innerHTML = `<option value="">${titulo}</option>` +
      valores.map((v) => `<option value="${v}">${v}</option>`).join("");
  };
  preencherSelect($("#filtro-area"), "Todas as áreas", [...new Set(AREAS.map(([n]) => n))].sort((a, b) => a.localeCompare(b, "pt")));
  preencherSelect($("#filtro-regiao"), "Todo o país", REGIOES.map(([n]) => n).reverse());
  preencherSelect($("#filtro-tipo"), "Universidades e politécnicos", ["Universidades", "Politécnicos"]);
  for (const k of ["area", "regiao", "tipo"]) {
    $("#filtro-" + k).addEventListener("change", (e) => { filtros[k] = e.target.value; atualizarInicio(); });
  }
}

function calcularPool() {
  pool = CURSOS.filter((c) =>
    (!filtros.area || c.area === filtros.area) &&
    (!filtros.regiao || c.regiao === filtros.regiao) &&
    (!filtros.tipo || c.tipo === filtros.tipo));
}

function atualizarInicio() {
  document.querySelectorAll(".modo").forEach((b) => {
    const sel = b.dataset.modo === modo;
    b.classList.toggle("selecionado", sel);
    b.setAttribute("aria-checked", sel);
  });
  calcularPool();
  const n = pool.length;
  const info = $("#info-filtro");
  if (n < 2) {
    info.textContent = "Não há cursos suficientes com estes filtros.";
    info.classList.add("aviso");
  } else {
    info.textContent = `${n.toLocaleString("pt-PT")} cursos em jogo` +
      (temFiltros() && lbAtivo() ? " · jogos com filtros não entram no leaderboard" : "");
    info.classList.remove("aviso");
  }
  $("#btn-comecar").disabled = n < 2;
  $("#recorde-inicio").textContent = recordeDe(modo);
  $("#streak-inicio").textContent = streakDe(modo);
  // nos modos clássicos a streak é igual aos pontos, por isso não se mostra
  $("#streak-inicio-box").hidden = !MODOS[modo].tempo;
}

// ================== Jogo ==================
function sortear(excluir) {
  const campo = MODOS[modo].campo;
  if (vistos.size > pool.length * 0.7) vistos.clear();
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (c === excluir) continue;
    if (vistos.has(c.id) && tentativa < 40) continue;
    // evita empates na maior parte das vezes
    if (excluir && c[campo] === excluir[campo] && tentativa < 50 && Math.random() < 0.85) continue;
    vistos.add(c.id);
    return c;
  }
  return pool.find((c) => c !== excluir);
}

function preencher(cartao, c, esconder) {
  const m = MODOS[modo];
  cartao.querySelector(".grau").textContent = GRAUS[c.grau] || c.grau;
  cartao.querySelector(".curso").textContent = c.curso;
  cartao.querySelector(".inst").textContent = c.inst;
  cartao.querySelector(".escola").textContent = c.escola;
  cartao.querySelector(".valor").textContent = esconder ? "" : formatar(c[m.campo], m.campo);
  cartao.querySelector(".valor-legenda").textContent = m.legenda;
  const outros = [["nota", "Nota"], ["vagas", "Vagas"], ["colocados", "Colocados"]].filter(([k]) => k !== m.campo);
  cartao.querySelector(".stats").innerHTML = outros
    .map(([k, rot]) => `<div><dt>${rot}</dt><dd>${formatar(c[k], k)}</dd></div>`).join("");
  cartao.classList.toggle("escondida", esconder);
  // nos modos de nota, as vagas e os colocados do segundo curso ficam visíveis como pista
  cartao.classList.toggle("pistas", Boolean(m.pistas));
}

function contar(el, alvo, campo, ms) {
  return new Promise((resolve) => {
    const inicio = performance.now();
    function passo(t) {
      const p = Math.min((t - inicio) / ms, 1);
      el.textContent = formatar(alvo * (1 - Math.pow(1 - p, 3)), campo);
      if (p < 1) requestAnimationFrame(passo); else resolve();
    }
    requestAnimationFrame(passo);
  });
}

function atualizarPlacar() {
  $("#pontos").textContent = pontos;
  $("#streak").textContent = streak;
  const box = $("#streak-box");
  box.classList.toggle("quente", streak >= 5);
  box.classList.toggle("fogo", streak >= 10);
  $("#recorde").textContent = Math.max(recordeDe(modo), pontos);
}

function comecar() {
  const m = MODOS[modo];
  calcularPool();
  if (pool.length < 2) return;
  vistos.clear();
  pontos = 0; streak = 0; melhorStreakJogo = 0; ultimoErro = null; jogoSubmetido = false;
  recordeAntes = recordeDe(modo);
  emJogo = true;

  $("#pergunta").textContent = m.pergunta;
  botoes[0].querySelector("span").textContent = m.alta;
  botoes[1].querySelector("span").textContent = m.baixa;

  atual = sortear();
  proximo = sortear(atual);
  preencher(cartaoA, atual, false);
  preencher(cartaoB, proximo, true);
  vs.className = "vs";
  vs.textContent = "VS";
  botoes.forEach((b) => (b.disabled = false));
  aBloquear = false;
  atualizarPlacar();

  const comTempo = Boolean(m.tempo);
  $("#streak-box").hidden = !comTempo;
  $("#tempo-box").hidden = !comTempo;
  $("#barra-tempo").hidden = !comTempo;
  clearInterval(timerId);
  if (comTempo) {
    fimTempo = performance.now() + m.tempo * 1000;
    timerId = setInterval(tick, 100);
    tick();
  }
  mostrarEcra("jogo");
}

function tick() {
  const m = MODOS[modo];
  tempoRestante = Math.max(0, (fimTempo - performance.now()) / 1000);
  $("#tempo").textContent = Math.ceil(tempoRestante);
  $("#tempo-box").classList.toggle("urgente", tempoRestante <= 10);
  $("#barra-tempo-fill").style.width = Math.min(100, (tempoRestante / m.tempo) * 100) + "%";
  if (tempoRestante <= 0) { clearInterval(timerId); terminar(); }
}

function ajustarTempo(seg) {
  fimTempo += seg * 1000;
  tick();
}

async function escolher(escolha) {
  if (aBloquear || !emJogo) return;
  aBloquear = true;
  botoes.forEach((b) => (b.disabled = true));
  const m = MODOS[modo];
  const campo = m.campo;
  const rapido = Boolean(m.tempo);

  cartaoB.classList.remove("escondida");
  await contar(cartaoB.querySelector(".valor"), proximo[campo], campo, rapido ? 350 : 700);
  if (!emJogo) return;

  const a = atual[campo], b = proximo[campo];
  const certo = a === b || (escolha === "alta" && b > a) || (escolha === "baixa" && b < a);

  vs.classList.add(certo ? "certo" : "errado");
  vs.textContent = certo ? "✓" : "✗";

  if (certo) {
    pontos++; streak++;
    melhorStreakJogo = Math.max(melhorStreakJogo, streak);
    if (pontos > recordeDe(modo)) guardarLS("hl-recorde-" + modo, pontos);
    if (melhorStreakJogo > streakDe(modo)) guardarLS("hl-streak-" + modo, melhorStreakJogo);
    if (rapido && streak % BONUS_CADA === 0) { ajustarTempo(BONUS); toast(`🔥 ${streak} seguidas · +${BONUS} s`, "bom"); }
  } else {
    ultimoErro = { a: atual, b: proximo };
    streak = 0;
    if (rapido) { ajustarTempo(-PENALIZACAO); toast(`−${PENALIZACAO} s`, "mau"); }
  }
  atualizarPlacar();

  await esperar(rapido ? 450 : 900);
  if (!emJogo) return;
  if (!certo && !rapido) return terminar();

  // o cartão da direita passa para a esquerda; entra um novo
  cartaoA.classList.add("sair");
  cartaoB.classList.add("sair");
  await esperar(rapido ? 200 : 350);
  if (!emJogo) return;
  atual = proximo;
  proximo = sortear(atual);
  preencher(cartaoA, atual, false);
  preencher(cartaoB, proximo, true);
  [cartaoA, cartaoB].forEach((c) => {
    c.classList.remove("sair");
    c.classList.add("entrar");
    c.addEventListener("animationend", () => c.classList.remove("entrar"), { once: true });
  });
  vs.className = "vs";
  vs.textContent = "VS";
  botoes.forEach((b) => (b.disabled = false));
  aBloquear = false;
}

function sair() {
  emJogo = false;
  clearInterval(timerId);
  mostrarEcra("inicio");
  atualizarInicio();
}

function terminar() {
  if (!emJogo) return;
  emJogo = false;
  clearInterval(timerId);
  const m = MODOS[modo];
  $("#fim-modo").textContent = `${m.icone} ${m.nome}` + (temFiltros() ? " · com filtros" : "");
  $("#fim-pontos").textContent = pontos;

  let msg = "";
  if (m.tempo) {
    msg = `Acabou o tempo! Acertaste ${pontos} ${pontos === 1 ? "vez" : "vezes"}.`;
  } else if (ultimoErro) {
    const { a, b } = ultimoErro, campo = m.campo;
    const unid = campo === "nota" ? "" : " " + m.legenda;
    msg = `${b.curso} (${b.inst}) tem ${formatar(b[campo], campo)}${unid}, ` +
      `contra ${formatar(a[campo], campo)} de ${a.curso} (${a.inst}).`;
  }
  if (pontos > recordeAntes) msg += " Novo recorde!";
  $("#fim-msg").textContent = msg;
  $("#fim-stats").textContent = m.tempo ? `Melhor streak neste jogo: 🔥 ${melhorStreakJogo}` : "";

  // leaderboard: com nome guardado, a pontuação é enviada logo; sem nome, pede-se no fim
  const pode = lbAtivo() && !temFiltros() && pontos > 0;
  const nome = nomeJogador();
  $("#form-lb").hidden = !pode || Boolean(nome);
  $("#lb-aviso-filtro").hidden = !(lbAtivo() && temFiltros() && pontos > 0);
  $("#lb-estado").textContent = "";
  $("#lb-estado").className = "lb-estado";
  $("#form-lb button").disabled = false;
  $("#nome").value = "";
  mostrarEcra("fim");
  if (pode && nome) enviarPontuacao(nome);
}

// ================== Leaderboard (Supabase) ==================
const CFG = typeof CONFIG !== "undefined" ? CONFIG : {};
const lbAtivo = () => Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);
let lbModo = modo;
const TOP = 10;

async function lbPedido(caminho, opcoes = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(CFG.SUPABASE_URL.replace(/\/+$/, "").replace(/\/rest\/v1$/, "") + "/rest/v1/" + caminho, {
      ...opcoes,
      signal: ctrl.signal,
      headers: { apikey: CFG.SUPABASE_KEY, "Content-Type": "application/json", ...(opcoes.headers || {}) },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  } finally { clearTimeout(t); }
}

let envioId = 0;

async function enviarPontuacao(nome) {
  if (jogoSubmetido) return;
  // fotografia do jogo: o jogador pode começar outro antes de o pedido acabar
  const id = ++envioId;
  const jogo = { nome, modo, pontos, melhor_streak: melhorStreakJogo };
  const estado = $("#lb-estado");
  const valido = () => id === envioId && ecras.fim.classList.contains("ativo");
  $("#form-lb button").disabled = true;
  estado.className = "lb-estado";
  estado.textContent = "A enviar para o leaderboard…";
  try {
    await lbPedido("pontuacoes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(jogo),
    });
    if (!valido()) return;
    jogoSubmetido = true;
    $("#form-lb").hidden = true;
    estado.className = "lb-estado ok";
    estado.innerHTML = `Pontuação enviada como <strong></strong>. <button type="button" class="btn-link" id="btn-lb-fim">Ver leaderboard</button>`;
    estado.querySelector("strong").textContent = nome;
    $("#btn-lb-fim").addEventListener("click", () => abrirLeaderboard(jogo.modo));
  } catch {
    if (!valido()) return;
    $("#form-lb").hidden = false;
    $("#nome").value = nome;
    estado.className = "lb-estado erro";
    estado.textContent = "Não foi possível enviar. Tenta outra vez.";
    $("#form-lb button").disabled = false;
  }
}

function lbSubmeter(e) {
  e.preventDefault();
  const nome = limparNome($("#nome").value);
  if (!nome) { $("#lb-estado").textContent = "Escreve um nome."; return; }
  guardarLS("hl-nome", nome);
  mostrarNome();
  enviarPontuacao(nome);
}

function abrirLeaderboard(m = modo) {
  lbModo = m;
  const tabs = $("#lb-tabs");
  tabs.innerHTML = "";
  for (const [id, md] of Object.entries(MODOS)) {
    const b = document.createElement("button");
    b.className = "tab" + (id === lbModo ? " ativa" : "");
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", id === lbModo);
    b.textContent = `${md.icone} ${md.nome}`;
    b.addEventListener("click", () => abrirLeaderboard(id));
    tabs.appendChild(b);
  }
  mostrarEcra("lb");
  carregarLeaderboard();
}

async function carregarLeaderboard() {
  const lista = $("#lb-lista");
  const estado = $("#lb-lista-estado");
  const pedido = lbModo;
  lista.innerHTML = "";
  estado.className = "lb-estado";
  estado.textContent = "A carregar…";
  // top das melhores pontuações (o mesmo jogador pode aparecer várias vezes)
  const campos = "select=nome,pontos,melhor_streak,criado_em";
  const chave = (n) => n.trim().toLowerCase();
  try {
    const r = await lbPedido(`pontuacoes?${campos}&modo=eq.${pedido}&order=pontos.desc,criado_em.asc&limit=${TOP}`);
    const ranking = await r.json();
    if (pedido !== lbModo) return;

    const meuNome = nomeJogador();
    let minha = meuNome ? ranking.findIndex((l) => chave(l.nome) === chave(meuNome)) : -1;
    let minhaLinha = ranking[minha];
    if (meuNome && minha < 0) {
      // fora do top: vai buscar a melhor pontuação do jogador (vista "melhores") e conta quantas estão à frente
      try {
        const rm = await lbPedido(`melhores?${campos}&modo=eq.${pedido}&chave=eq.${encodeURIComponent(chave(meuNome))}`);
        minhaLinha = (await rm.json())[0];
        if (minhaLinha) {
          const rc = await lbPedido(`pontuacoes?select=nome&modo=eq.${pedido}&pontos=gt.${minhaLinha.pontos}`, {
            method: "HEAD", headers: { Prefer: "count=exact", Range: "0-0" },
          });
          const frente = Number((rc.headers.get("content-range") || "").split("/")[1]);
          minha = Number.isFinite(frente) ? frente : -1;
        }
      } catch {}
      if (pedido !== lbModo) return;
    }

    estado.textContent = ranking.length ? "" : "Ainda ninguém jogou este modo. Sê o primeiro!";
    const comStreak = Boolean(MODOS[pedido].tempo);
    const linhaLi = (l, i) => {
      const li = document.createElement("li");
      if (chave(l.nome) === chave(meuNome)) li.classList.add("eu");
      const data = new Date(l.criado_em).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
      li.innerHTML = `<span class="pos">${i < 0 ? "—" : ["🥇", "🥈", "🥉"][i] || i + 1}</span>
        <span class="lb-nome"></span>
        <span class="lb-extra">${comStreak ? `🔥 ${l.melhor_streak} · ` : ""}${data}</span>
        <strong class="lb-pontos">${l.pontos}</strong>`;
      li.querySelector(".lb-nome").textContent = l.nome + (li.classList.contains("eu") ? " (tu)" : "");
      return li;
    };
    ranking.forEach((l, i) => lista.appendChild(linhaLi(l, i)));
    // o jogador vê sempre a sua linha, mesmo fora do top
    if (minhaLinha && !ranking.includes(minhaLinha)) {
      const sep = document.createElement("li");
      sep.className = "lb-separador";
      sep.textContent = "⋯";
      lista.append(sep, linhaLi(minhaLinha, minha));
    }
  } catch {
    if (pedido !== lbModo) return;
    estado.className = "lb-estado erro";
    estado.textContent = "Não foi possível carregar o leaderboard.";
  }
}

// ================== Eventos ==================
$("#btn-comecar").addEventListener("click", comecar);
$("#btn-repetir").addEventListener("click", comecar);
$("#btn-menu").addEventListener("click", () => { mostrarEcra("inicio"); atualizarInicio(); });
$("#btn-sair").addEventListener("click", sair);
$("#btn-ver-lb").addEventListener("click", () => abrirLeaderboard(modo));
$("#btn-lb-voltar").addEventListener("click", () => { mostrarEcra("inicio"); atualizarInicio(); });
$("#form-lb").addEventListener("submit", lbSubmeter);
$("#form-jogador").addEventListener("submit", guardarNome);
$("#btn-mudar-nome").addEventListener("click", () => mostrarNome(true));
botoes.forEach((b) => b.addEventListener("click", () => escolher(b.dataset.escolha)));
document.addEventListener("keydown", (e) => {
  if (ecras.jogo.classList.contains("ativo")) {
    if (e.key === "ArrowUp") { e.preventDefault(); escolher("alta"); }
    if (e.key === "ArrowDown") { e.preventDefault(); escolher("baixa"); }
    if (e.key === "Escape") sair();
  } else if (e.key === "Enter" && ecras.inicio.classList.contains("ativo") &&
             !["SELECT", "INPUT"].includes(document.activeElement.tagName)) {
    if (!$("#btn-comecar").disabled) comecar();
  }
});

construirModos();
construirFiltros();
mostrarNome();
$("#btn-ver-lb").hidden = !lbAtivo();
atualizarInicio();
