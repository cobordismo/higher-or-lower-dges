// se o localStorage falhar (modo privado, browsers dentro de apps), o valor fica pelo menos em memória
const memoriaLS = new Map();

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
    chave: `${nomeInst}|${curso}|${grau}`, // identifica o curso na base de dados
  };
});
const CURSO_POR_CHAVE = new Map(CURSOS.map((c) => [c.chave, c]));

const GRAUS = { L1: "Licenciatura", MI: "Mestrado Integrado" };

// ================== Modos ==================
// O primeiro modo é o principal: aparece em destaque e é o escolhido por omissão.
const MODOS = {
  relogio: {
    nome: "Contra-relógio", icone: "⏱", campo: "nota", tempo: 120, pistas: true,
    desc: "Notas · 120 s · errar −7 s · 5 seguidas +5 s",
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
    desc: "Vagas · 60 s",
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
let palpitesJogo = []; // palpites deste jogo, enviados no fim (cursos subestimados/sobrestimados)

// migrar recorde da versão anterior
if (lerLS("hl-recorde", null) && !lerLS("hl-recorde-classico", null)) guardarLS("hl-recorde-classico", lerLS("hl-recorde", 0));

// ================== Elementos ==================
const $ = (s) => document.querySelector(s);
const ecras = { inicio: $("#ecra-inicio"), jogo: $("#ecra-jogo"), fim: $("#ecra-fim"), lb: $("#ecra-lb"), cursos: $("#ecra-cursos") };
const cartaoA = $("#cartao-a");
const cartaoB = $("#cartao-b");
const vs = $("#vs");
const botoes = document.querySelectorAll("#botoes .btn");

// ================== Utilitários ==================
function lerLS(k, def) {
  try { const v = localStorage.getItem(k); if (v !== null) return v; } catch {}
  return memoriaLS.has(k) ? memoriaLS.get(k) : def;
}
function guardarLS(k, v) { memoriaLS.set(k, String(v)); try { localStorage.setItem(k, v); } catch {} }
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

// quem escreve o nome e carrega logo em "Jogar" (sem "Guardar") também fica com o nome guardado
function guardarNomeEscrito() {
  if ($("#form-jogador").hidden) return;
  const nome = limparNome($("#nome-jogador").value);
  if (nome) { guardarLS("hl-nome", nome); mostrarNome(); }
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
  guardarNomeEscrito();
  const m = MODOS[modo];
  calcularPool();
  if (pool.length < 2) return;
  vistos.clear();
  pontos = 0; streak = 0; melhorStreakJogo = 0; ultimoErro = null; jogoSubmetido = false;
  palpitesJogo = [];
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
  // escolheu "mais baixa" e era mais alta → subestimado; o contrário → sobrestimado
  palpitesJogo.push({ campo, chave: proximo.chave, tipo: certo ? "ok" : escolha === "baixa" ? "sub" : "sobre" });

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
  if (emJogo) enviarPalpites();
  emJogo = false;
  clearInterval(timerId);
  mostrarEcra("inicio");
  atualizarInicio();
}

function terminar() {
  if (!emJogo) return;
  emJogo = false;
  enviarPalpites();
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

async function lbPedido(caminho, opcoes = {}, tempoMax = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), tempoMax);
  try {
    const r = await fetch(CFG.SUPABASE_URL.replace(/\/+$/, "").replace(/\/rest\/v1$/, "") + "/rest/v1/" + caminho, {
      ...opcoes,
      signal: ctrl.signal,
      headers: { apikey: CFG.SUPABASE_KEY, "Content-Type": "application/json", ...(opcoes.headers || {}) },
    });
    if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status });
    return r;
  } finally { clearTimeout(t); }
}

let envioId = 0;

// Pontuações ainda não confirmadas pelo servidor. Ficam guardadas no browser até serem aceites,
// para não se perderem com rede fraca (telemóvel), o Supabase lento a acordar ou a página fechada a meio.
const lerPendentes = () => { try { return JSON.parse(lerLS("hl-pendentes", "[]")) || []; } catch { return []; } };
const guardarPendentes = (l) => guardarLS("hl-pendentes", JSON.stringify(l.slice(-20)));
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() :
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// envia uma pontuação; o id é gerado no browser, por isso repetir o envio nunca cria duplicados
async function enviarJogo(jogo, aFechar = false) {
  try {
    await lbPedido("pontuacoes", {
      method: "POST",
      keepalive: aFechar, // só ao fechar a página: nem todos os browsers aceitam keepalive sempre
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(jogo),
    }, 20000);
  } catch (e) {
    if (e.status !== 409) throw e; // 409 = já tinha sido guardada numa tentativa anterior
  }
  guardarPendentes(lerPendentes().filter((p) => p.id !== jogo.id));
}

let aReenviar = false;
async function reenviarPendentes() {
  if (!lbAtivo() || aReenviar) return;
  aReenviar = true;
  try {
    for (const jogo of lerPendentes()) await enviarJogo(jogo);
  } catch {} finally { aReenviar = false; }
}

async function enviarPontuacao(nome) {
  if (jogoSubmetido) return;
  // fotografia do jogo: o jogador pode começar outro antes de o pedido acabar
  const id = ++envioId;
  const jogo = { id: novoId(), nome, modo, pontos, melhor_streak: melhorStreakJogo };
  jogoSubmetido = true;
  guardarPendentes([...lerPendentes(), jogo]);
  const estado = $("#lb-estado");
  const valido = () => id === envioId && ecras.fim.classList.contains("ativo");
  $("#form-lb button").disabled = true;
  $("#form-lb").hidden = true;
  estado.className = "lb-estado";
  estado.textContent = "A enviar para o leaderboard…";
  for (let tentativa = 1; ; tentativa++) {
    try {
      await enviarJogo(jogo);
      break;
    } catch {
      if (tentativa >= 3) {
        if (!valido()) return;
        estado.className = "lb-estado erro";
        estado.innerHTML = `Sem ligação ao leaderboard. A pontuação ficou guardada e é enviada assim que possível. ` +
          `<button type="button" class="btn-link" id="btn-lb-tentar">Tentar agora</button>`;
        $("#btn-lb-tentar").addEventListener("click", async () => {
          estado.className = "lb-estado";
          estado.textContent = "A enviar para o leaderboard…";
          await reenviarPendentes();
          if (!valido()) return;
          const falta = lerPendentes().some((p) => p.id === jogo.id);
          estado.className = "lb-estado " + (falta ? "erro" : "ok");
          estado.textContent = falta ? "Ainda sem ligação. Voltamos a tentar mais tarde." : "Pontuação enviada!";
        });
        return;
      }
      if (valido()) estado.textContent = `A enviar para o leaderboard… (tentativa ${tentativa + 1})`;
      await esperar(tentativa * 2000);
    }
  }
  if (!valido()) return;
  estado.className = "lb-estado ok";
  estado.innerHTML = `Pontuação enviada como <strong></strong>. <button type="button" class="btn-link" id="btn-lb-fim">Ver leaderboard</button>`;
  estado.querySelector("strong").textContent = nome;
  $("#btn-lb-fim").addEventListener("click", () => abrirLeaderboard(jogo.modo));
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

// estado da lista aberta: permite carregar mais linhas sem repetir pedidos
const MAIS = 50;
const lb = { pedido: null, carregadas: 0, total: 0, minha: -1, minhaLinha: null, meuNome: "" };
const chaveNome = (n) => n.trim().toLowerCase();
const camposLb = "select=nome,pontos,melhor_streak,criado_em";

function linhaLb(l, i) {
  const li = document.createElement("li");
  if (lb.meuNome && chaveNome(l.nome) === chaveNome(lb.meuNome)) li.classList.add("eu");
  const quando = new Date(l.criado_em);
  const data = quando.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }) + " · " +
    quando.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const comStreak = Boolean(MODOS[lb.pedido].tempo);
  li.innerHTML = `<span class="pos${i >= 0 && i < 3 ? " pos-" + (i + 1) : ""}">${i < 0 ? "—" : i + 1}</span>
    <span class="lb-nome"></span>
    <span class="lb-extra">${comStreak ? `🔥 ${l.melhor_streak} · ` : ""}${data}</span>
    <strong class="lb-pontos">${l.pontos}</strong>`;
  li.querySelector(".lb-nome").textContent = l.nome + (li.classList.contains("eu") ? " (tu)" : "");
  return li;
}

// pede uma página do ranking e devolve as linhas; lê o total do cabeçalho Content-Range
async function paginaLb(pedido, inicio, n) {
  const r = await lbPedido(`pontuacoes?${camposLb}&modo=eq.${pedido}&order=pontos.desc,melhor_streak.desc,criado_em.asc` +
    `&offset=${inicio}&limit=${n}`, { headers: { Prefer: "count=exact" } });
  const total = Number((r.headers.get("content-range") || "").split("/")[1]);
  return { linhas: await r.json(), total: Number.isFinite(total) ? total : null };
}

// a linha do próprio jogador aparece no fim (depois de "⋯") enquanto ainda não foi carregada
function desenharMinhaLb() {
  const lista = $("#lb-lista");
  lista.querySelectorAll(".lb-separador, .lb-minha").forEach((el) => el.remove());
  if (lb.minhaLinha && !(lb.minha >= 0 && lb.minha < lb.carregadas)) {
    const sep = document.createElement("li");
    sep.className = "lb-separador";
    sep.textContent = "⋯";
    const li = linhaLb(lb.minhaLinha, lb.minha);
    li.classList.add("lb-minha");
    lista.append(sep, li);
  }
  const falta = lb.total - lb.carregadas;
  const btn = $("#btn-lb-mais");
  btn.hidden = !(falta > 0);
  btn.disabled = false;
  btn.textContent = lb.carregadas <= TOP ? `⋯ Ver todas (${lb.total})` : `⋯ Ver mais (faltam ${falta})`;
}

async function carregarLeaderboard() {
  const lista = $("#lb-lista");
  const estado = $("#lb-lista-estado");
  const pedido = lbModo;
  lista.innerHTML = "";
  $("#btn-lb-mais").hidden = true;
  $("#lb-titulo").textContent = `🏆 Top ${TOP}`;
  // nos modos clássicos a streak é igual aos pontos, por isso só o tempo desempata
  $("#lb-desempate").textContent = MODOS[pedido].tempo
    ? "Empates nos pontos: ganha a melhor streak 🔥; se continuar empatado, quem chegou primeiro."
    : "Empates nos pontos: ganha quem chegou primeiro.";
  carregarTimeline(pedido);
  estado.className = "lb-estado";
  estado.textContent = "A carregar…";
  try {
    const { linhas: ranking, total } = await paginaLb(pedido, 0, TOP);
    if (pedido !== lbModo) return;
    Object.assign(lb, { pedido, carregadas: ranking.length, total: total ?? ranking.length,
      meuNome: nomeJogador(), minha: -1, minhaLinha: null });

    const meu = chaveNome(lb.meuNome);
    lb.minha = meu ? ranking.findIndex((l) => chaveNome(l.nome) === meu) : -1;
    lb.minhaLinha = ranking[lb.minha] || null;
    if (meu && lb.minha < 0) {
      // fora do top: vai buscar a melhor pontuação do jogador (vista "melhores") e conta quantas estão à frente
      try {
        const rm = await lbPedido(`melhores?${camposLb}&modo=eq.${pedido}&chave=eq.${encodeURIComponent(meu)}`);
        lb.minhaLinha = (await rm.json())[0] || null;
        if (lb.minhaLinha) {
          const { pontos: p, melhor_streak: st } = lb.minhaLinha;
          // à frente: mais pontos, ou os mesmos pontos com melhor streak
          const rc = await lbPedido(`pontuacoes?select=nome&modo=eq.${pedido}` +
            `&or=(pontos.gt.${p},and(pontos.eq.${p},melhor_streak.gt.${st}))`, {
            method: "HEAD", headers: { Prefer: "count=exact", Range: "0-0" },
          });
          const frente = Number((rc.headers.get("content-range") || "").split("/")[1]);
          lb.minha = Number.isFinite(frente) ? frente : -1;
        }
      } catch {}
      if (pedido !== lbModo) return;
    }

    estado.textContent = ranking.length ? "" : "Ainda ninguém jogou este modo. Sê o primeiro!";
    ranking.forEach((l, i) => lista.appendChild(linhaLb(l, i)));
    desenharMinhaLb();
  } catch {
    if (pedido !== lbModo) return;
    estado.className = "lb-estado erro";
    estado.textContent = "Não foi possível carregar o leaderboard.";
  }
}

async function verMaisLb() {
  const pedido = lb.pedido;
  const btn = $("#btn-lb-mais");
  btn.disabled = true;
  btn.textContent = "A carregar…";
  try {
    const { linhas, total } = await paginaLb(pedido, lb.carregadas, MAIS);
    if (pedido !== lbModo) return;
    const lista = $("#lb-lista");
    lista.querySelectorAll(".lb-separador, .lb-minha").forEach((el) => el.remove());
    linhas.forEach((l, i) => lista.appendChild(linhaLb(l, lb.carregadas + i)));
    lb.carregadas += linhas.length;
    $("#lb-titulo").textContent = "🏆 Ranking completo";
    if (total !== null) lb.total = total;
    if (!linhas.length) lb.total = lb.carregadas;
    desenharMinhaLb();
  } catch {
    btn.disabled = false;
    btn.textContent = "Não foi possível carregar. Tentar outra vez";
  }
}

// ================== Timeline do 1.º lugar ==================
// A contagem começa aqui (hora de Portugal): o que aconteceu antes não conta para a timeline.
const INICIO_TIMELINE = new Date("2026-09-24T11:00:00+01:00");

function duracao(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "menos de 1 min";
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d) return `${d} d${h ? ` ${h} h` : ""}`;
  if (h) return `${h} h${m ? ` ${m} min` : ""}`;
  return `${m} min`;
}

const quando = (iso) => {
  const t = new Date(iso);
  return t.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }) + " " +
    t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
};

async function carregarTimeline(pedido) {
  const lista = $("#timeline"), resumo = $("#timeline-resumo"), box = $("#timeline-box");
  lista.innerHTML = ""; resumo.innerHTML = "";
  box.hidden = true;
  try {
    const r = await lbPedido(`lideres?select=nome,pontos,melhor_streak,desde,ate&modo=eq.${pedido}&order=desde.desc&limit=200`);
    // corta na hora de início: reinados que acabaram antes saem; o líder dessa hora conta só a partir dela
    const reinados = (await r.json())
      .filter((x) => !x.ate || new Date(x.ate) > INICIO_TIMELINE)
      .map((x) => new Date(x.desde) < INICIO_TIMELINE ? { ...x, desde: INICIO_TIMELINE.toISOString() } : x);
    if (pedido !== lbModo || !reinados.length) return;
    const agora = Date.now();
    const comStreak = Boolean(MODOS[pedido].tempo);
    reinados.forEach((x) => { x.ms = (x.ate ? new Date(x.ate) : agora) - new Date(x.desde); });

    // resumo: tempo total em 1.º por jogador
    const total = new Map();
    for (const x of reinados) {
      const k = chaveNome(x.nome);
      const t = total.get(k) || { nome: x.nome, ms: 0, vezes: 0 };
      t.ms += x.ms; t.vezes++;
      total.set(k, t);
    }
    const jogadores = [...total.values()].sort((a, b) => b.ms - a.ms);
    const soma = jogadores.reduce((s, j) => s + j.ms, 0) || 1;
    const meu = chaveNome(nomeJogador());
    for (const j of jogadores.slice(0, 8)) {
      const div = document.createElement("div");
      div.className = "tl-jogador" + (chaveNome(j.nome) === meu ? " eu" : "");
      div.innerHTML = `<span class="tl-j-nome"></span>
        <span class="tl-barra"><span style="width:${Math.max(2, (100 * j.ms) / soma)}%"></span></span>
        <span class="tl-j-tempo">${duracao(j.ms)}</span>`;
      div.querySelector(".tl-j-nome").textContent = j.nome;
      div.title = `${j.vezes} ${j.vezes === 1 ? "vez" : "vezes"} em 1.º`;
      resumo.appendChild(div);
    }

    // cronologia: do mais recente para o mais antigo
    reinados.forEach((x, i) => {
      const li = document.createElement("li");
      li.className = (x.ate ? "" : "atual ") + (chaveNome(x.nome) === meu ? "eu" : "");
      li.innerHTML = `<span class="tl-ponto"></span>
        <div class="tl-corpo">
          <div class="tl-linha"><strong class="tl-nome"></strong>
            <span class="tl-pts">${x.pontos} pts${comStreak ? ` · 🔥 ${x.melhor_streak}` : ""}</span></div>
          <div class="tl-quando">${quando(x.desde)} → ${x.ate ? quando(x.ate) : "agora"} ·
            <b>${x.ate ? duracao(x.ms) : duracao(x.ms) + " e a contar"}</b></div>
        </div>`;
      li.querySelector(".tl-nome").textContent = (x.ate ? "" : "👑 ") + x.nome;
      lista.appendChild(li);
    });
    box.hidden = false;
  } catch {}
}

// ================== Cursos subestimados / sobrestimados ==================
function enviarPalpites(aFechar = false) {
  const eventos = palpitesJogo.slice(0, 300);
  palpitesJogo = [];
  if (!lbAtivo() || !eventos.length) return;
  // keepalive (só ao fechar a página): o pedido chega mesmo que o jogador saia logo a seguir
  lbPedido("rpc/registar_palpites", { method: "POST", keepalive: aFechar, body: JSON.stringify({ eventos }) })
    .catch(() => {});
}

let cursosCampo = "nota";
const MIN_PALPITES = 3; // abaixo disto a percentagem ainda não diz nada

function abrirCursos(campo = cursosCampo) {
  cursosCampo = campo;
  document.querySelectorAll("#cursos-tabs .tab").forEach((b) => {
    const ativa = b.dataset.campo === campo;
    b.classList.toggle("ativa", ativa);
    b.setAttribute("aria-selected", ativa);
  });
  const nota = campo === "nota";
  $("#cursos-legenda-sub").textContent = nota ? "Os jogadores acharam a nota mais baixa do que é." : "Os jogadores acharam que tinha menos vagas.";
  $("#cursos-legenda-sobre").textContent = nota ? "Os jogadores acharam a nota mais alta do que é." : "Os jogadores acharam que tinha mais vagas.";
  $("#cursos-nota").textContent = `Percentagem dos palpites em que os jogadores erraram assim. Só entram cursos com pelo menos ${MIN_PALPITES} palpites.`;
  mostrarEcra("cursos");
  carregarCursos("sub", $("#lista-sub"));
  carregarCursos("sobre", $("#lista-sobre"));
}

async function carregarCursos(tipo, lista) {
  const campo = cursosCampo;
  const col = tipo === "sub" ? "subestimado" : "sobrestimado";
  lista.innerHTML = `<li class="lb-separador">A carregar…</li>`;
  try {
    // pede um pouco mais do que 10 para o caso de haver chaves que já não existem nos dados
    const r = await lbPedido(`palpites_cursos_pct?select=chave,vezes,${col},pct_${tipo}&campo=eq.${campo}` +
      `&vezes=gte.${MIN_PALPITES}&${col}=gt.0&order=pct_${tipo}.desc,vezes.desc&limit=${TOP + 10}`);
    const linhas = (await r.json()).filter((l) => CURSO_POR_CHAVE.has(l.chave)).slice(0, TOP);
    if (campo !== cursosCampo) return;
    lista.innerHTML = "";
    if (!linhas.length) lista.innerHTML = `<li class="lb-separador">Ainda sem dados suficientes. Joga para começar!</li>`;
    linhas.forEach((l, i) => {
      const c = CURSO_POR_CHAVE.get(l.chave);
      const pct = Math.round(Number(l[`pct_${tipo}`]));
      const li = document.createElement("li");
      li.innerHTML = `<span class="pos${i < 3 ? " pos-" + (i + 1) : ""}">${i + 1}</span>
        <span class="lb-nome"></span><span class="lb-extra"></span>
        <span class="lb-pontos lb-pct"><strong>${pct}%</strong><small>${l[col]} em ${l.vezes}</small></span>`;
      li.querySelector(".lb-nome").textContent = c.curso;
      li.querySelector(".lb-extra").textContent =
        `${c.inst} · ${formatar(c[campo], campo)}${campo === "vagas" ? " vagas" : ""}`;
      li.querySelector(".lb-pct").title = `${l[col]} de ${l.vezes} palpites`;
      lista.appendChild(li);
    });
  } catch {
    if (campo !== cursosCampo) return;
    lista.innerHTML = `<li class="lb-separador erro">Não foi possível carregar.</li>`;
  }
}

// ================== Eventos ==================
$("#btn-comecar").addEventListener("click", comecar);
$("#btn-repetir").addEventListener("click", comecar);
$("#btn-menu").addEventListener("click", () => { mostrarEcra("inicio"); atualizarInicio(); });
$("#btn-sair").addEventListener("click", sair);
$("#btn-ver-lb").addEventListener("click", () => abrirLeaderboard(modo));
$("#btn-lb-mais").addEventListener("click", verMaisLb);
$("#btn-ver-cursos").addEventListener("click", () => abrirCursos());
$("#btn-lb-cursos").addEventListener("click", () => abrirCursos());
$("#btn-cursos-voltar").addEventListener("click", () => { mostrarEcra("inicio"); atualizarInicio(); });
document.querySelectorAll("#cursos-tabs .tab").forEach((b) => b.addEventListener("click", () => abrirCursos(b.dataset.campo)));
// a página vai fechar: última tentativa de enviar o que ainda não chegou ao servidor
window.addEventListener("pagehide", () => {
  if (emJogo) enviarPalpites(true);
  if (lbAtivo()) lerPendentes().forEach((j) => enviarJogo(j, true).catch(() => {}));
});
window.addEventListener("online", reenviarPendentes);
$("#btn-lb-voltar").addEventListener("click", () => { mostrarEcra("inicio"); atualizarInicio(); });
$("#form-lb").addEventListener("submit", lbSubmeter);
$("#form-jogador").addEventListener("submit", guardarNome);
$("#nome-jogador").addEventListener("change", guardarNomeEscrito);
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
reenviarPendentes();
$("#btn-ver-cursos").hidden = !lbAtivo();
atualizarInicio();
