// Busca os dados das seis Ps no GitHub, encontra a turma em cada P e junta os alunos.
const fs = require('fs/promises');
const path = require('path');
const { P, ORDEM_P, OWNER, normalizar } = require('./fontes');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_DATA_TOKEN || '';
const BRANCH = process.env.GITHUB_DADOS_BRANCH || 'main';
const CAMINHO = process.env.GITHUB_DADOS_PATH || 'dados/turmas.json';
const DADOS_LOCAIS = process.env.DADOS_LOCAIS || ''; // pasta com P1.json ... P6.json (testes)

let cache = { em: 0, bases: null, status: {} };

async function buscarBase(id) {
  if (DADOS_LOCAIS) {
    try { return JSON.parse(await fs.readFile(path.join(DADOS_LOCAIS, `${id}.json`), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return { turmas: [] }; throw e; }
  }
  if (!TOKEN) throw new Error('GITHUB_TOKEN não configurado no servidor.');
  const url = `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(P[id].repo)}/contents/${CAMINHO.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'fechamento-portfolio-tedpro' } });
  if (r.status === 404) throw new Error(`não encontrei ${CAMINHO} em ${P[id].repo} (o repositório existe e o token tem acesso a ele?)`);
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} para ${P[id].repo}`);
  const texto = await r.text();
  return JSON.parse(texto);
}

// Lê as seis bases (com cache de 10 minutos, ou forçando a atualização).
async function carregarBases(forcar = false) {
  if (!forcar && cache.bases && Date.now() - cache.em < 10 * 60 * 1000) return cache;
  const bases = {}, status = {};
  await Promise.all(ORDEM_P.map(async (id) => {
    try {
      const b = await buscarBase(id);
      bases[id] = Array.isArray(b?.turmas) ? b : { turmas: [] };
      status[id] = { ok: true, turmas: bases[id].turmas.length, avaliacoes: bases[id].turmas.reduce((s, t) => s + (t.avaliacoes || []).length, 0) };
    } catch (e) { bases[id] = { turmas: [] }; status[id] = { ok: false, erro: e.message }; }
  }));
  cache = { em: Date.now(), bases, status };
  return cache;
}

// ---------- nomes ----------
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const normNome = (s) => semAcento(s).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const tokensNome = (s) => normNome(s).split(' ').filter((t) => t && !PARTICULAS.has(t));
const digitos = (s) => String(s || '').replace(/\D/g, '');
function nomesParecidos(a, b) {
  const ta = tokensNome(a), tb = tokensNome(b);
  if (!ta.length || !tb.length) return false;
  if (ta[0] !== tb[0]) return false; // mesmo primeiro nome
  const sa = new Set(ta), sb = new Set(tb);
  const comuns = [...sa].filter((t) => sb.has(t)).length;
  return comuns >= 2 && comuns / Math.min(sa.size, sb.size) >= 0.66;
}

// ---------- turmas ----------
const normTurma = (s) => semAcento(s).toLowerCase().replace(/\bturma\b|\btedpro\b|\bp[1-6]\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const chaveNomeTurma = (s) => normTurma(s).split(' ').filter(Boolean).sort().join(' ');
function listarTurmas(bases) {
  const nomes = new Map();
  for (const id of ORDEM_P) for (const t of bases[id].turmas) {
    const chave = chaveNomeTurma(t.nome) || t.id;
    if (!nomes.has(chave)) nomes.set(chave, { chave, nome: t.nome, ps: {} });
    nomes.get(chave).ps[id] = { id: t.id, nome: t.nome, quantidade: (t.avaliacoes || []).length };
  }
  return [...nomes.values()].sort((a, b) => Object.keys(b.ps).length - Object.keys(a.ps).length || a.nome.localeCompare(b.nome, 'pt-BR'));
}
// Sugere, para cada P, a turma cujo nome mais se parece com o pedido.
function sugerirTurmas(bases, pedido) {
  const alvo = normTurma(pedido).split(' ').filter(Boolean);
  const out = {};
  for (const id of ORDEM_P) {
    let melhor = null, nota = 0;
    for (const t of bases[id].turmas) {
      const tt = normTurma(t.nome).split(' ').filter(Boolean);
      const comuns = alvo.filter((x) => tt.some((y) => y === x || (x.length > 4 && (y.startsWith(x) || x.startsWith(y))))).length;
      const s = alvo.length ? comuns / alvo.length : 0;
      if (s > nota) { nota = s; melhor = t; }
    }
    out[id] = melhor && nota >= 0.5 ? melhor.id : '';
  }
  return out;
}

// ---------- junção dos alunos ----------
// mapa: {P1: turmaId, ...}; vinculos: {"P3:avaliacaoId": "chaveDoAluno"} (ajustes manuais)
function juntarAlunos(bases, mapa, vinculos = {}) {
  const alunos = [];
  const duplicadas = [];
  const porMatricula = new Map(), porNome = new Map();
  // chave estável: matrícula quando houver, senão o nome normalizado
  const novaChave = (n, mat) => { let k = mat ? `m-${mat}` : `n-${normNome(n).replace(/\s+/g, '-').slice(0, 40)}`; while (alunos.some((x) => x.chave === k)) k += '-2'; return k; };
  for (const id of ORDEM_P) {
    const turma = bases[id].turmas.find((t) => t.id === mapa[id]);
    if (!turma) continue;
    for (const bruto of turma.avaliacoes || []) {
      const av = normalizar(id, bruto);
      if (!av.nome && !av.matricula) continue;
      const mat = digitos(av.matricula).length >= 6 ? digitos(av.matricula) : '';
      let aluno = null, como = '';
      const manual = vinculos[`${id}:${av.id}`];
      if (manual) { aluno = alunos.find((x) => x.chave === manual) || null; if (!aluno) { aluno = { chave: manual, nome: av.nome, matricula: mat || av.matricula, ps: {}, juncao: {} }; alunos.push(aluno); } como = 'manual'; }
      if (!aluno && mat && porMatricula.has(mat)) { aluno = porMatricula.get(mat); como = 'matrícula'; }
      if (!aluno && porNome.has(normNome(av.nome))) { aluno = porNome.get(normNome(av.nome)); como = 'nome'; }
      if (!aluno) { aluno = alunos.find((x) => nomesParecidos(x.nome, av.nome)) || null; if (aluno) como = 'nome parecido'; }
      if (!aluno) { aluno = { chave: novaChave(av.nome || av.matricula, mat), nome: av.nome, matricula: mat || av.matricula, ps: {}, juncao: {} }; alunos.push(aluno); como = 'primeira entrega'; }
      if (aluno.ps[id]) { // duas avaliações do mesmo aluno na mesma P: fica a mais recente
        const atual = aluno.ps[id];
        const maisNova = String(av.atualizadoEm) > String(atual.atualizadoEm) ? av : atual;
        duplicadas.push({ p: id, aluno: aluno.nome, mantida: maisNova.id, descartada: (maisNova === av ? atual : av).id });
        aluno.ps[id] = maisNova;
      } else aluno.ps[id] = av;
      aluno.juncao[id] = { como, nomeNaP: av.nome, matriculaNaP: av.matricula, avaliacaoId: av.id };
      if (!aluno.matricula && mat) aluno.matricula = mat;
      if (mat) porMatricula.set(mat, aluno);
      if (av.nome) porNome.set(normNome(av.nome), aluno);
      if (av.nome && av.nome.length > aluno.nome.length) aluno.nome = av.nome; // fica o nome mais completo
    }
  }
  for (const a of alunos) {
    a.entregues = ORDEM_P.filter((id) => a.ps[id]);
    a.faltam = ORDEM_P.filter((id) => mapa[id] && !a.ps[id]);
    a.completo = a.entregues.length === ORDEM_P.length;
  }
  alunos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  return { alunos, duplicadas };
}

module.exports = { carregarBases, listarTurmas, sugerirTurmas, juntarAlunos, normNome, nomesParecidos, normTurma, statusFonte: () => ({ token: Boolean(TOKEN), local: Boolean(DADOS_LOCAIS) }) };
