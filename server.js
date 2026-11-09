require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const dados = require('./dados');
const padlet = require('./padlet');
const { fatosAluno, fatosTurma, contextoTurma } = require('./fatos');
const { montarPromptDossie, montarPromptTurma, limparDossie, limparTurma } = require('./prompts');
const { P, ORDEM_P, TEMAS } = require('./fontes');
const { configIA, configDaRequisicao, chamarIA, statusIA } = require('./ia');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_USERNAME = process.env.APP_USERNAME || 'professor';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const VERSAO_PROMPT = 'v2';
if (process.env.NODE_ENV === 'production' && !APP_PASSWORD) throw new Error('APP_PASSWORD é obrigatória em produção.');

app.use((req, res, next) => {
  if (!APP_PASSWORD || req.path === '/api/health' || !req.path.startsWith('/api/')) return next();
  let usuario = '', senha = '';
  try { [usuario, senha] = Buffer.from((req.headers.authorization || '').replace(/^Basic\s+/i, ''), 'base64').toString('utf8').split(':'); } catch {}
  if (usuario === APP_USERNAME && senha === APP_PASSWORD) return next();
  res.set('X-Login-Necessario', '1');
  return res.status(401).send('Autenticação necessária.');
});
app.use(express.json({ limit: '8mb' }));
app.use((req, _res, next) => { req.ia = configDaRequisicao(req); next(); });
app.use(express.static(path.join(__dirname, 'public')));

const chaveTurma = (nome) => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const hash = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
const erro = (res, e, status = 500) => res.status(e.status || status).json({ erro: e.message });

app.get('/api/health', (_req, res) => res.json({ ok: true, ...statusIA(configIA()), dados: dados.statusFonte(), padletApi: padlet.apiConfigurada(), postgresConfigurado: db.usaPostgres(), backupGitHubConfigurado: Boolean(db.statusBackup().configurado) }));

// Fontes (as seis Ps) e turmas encontradas em cada uma
app.get('/api/fontes', async (req, res) => {
  try {
    const c = await dados.carregarBases(req.query.atualizar === '1');
    res.json({ atualizadoEm: new Date(c.em).toISOString(), status: Object.fromEntries(ORDEM_P.map((id) => [id, { ...c.status[id], repo: P[id].repo, titulo: P[id].titulo }])), turmas: dados.listarTurmas(c.bases), abertas: await db.listar() });
  } catch (e) { erro(res, e); }
});
app.post('/api/turmas/sugerir', async (req, res) => {
  try { const c = await dados.carregarBases(); res.json({ mapa: dados.sugerirTurmas(c.bases, req.body?.pedido || '') }); } catch (e) { erro(res, e); }
});

// Monta a turma: junção dos alunos + fatos calculados.
async function montarTurma(chave, { forcar = false } = {}) {
  const estado = await db.lerTurma(chave);
  if (!estado) { const e = new Error('Turma ainda não aberta no Fechamento.'); e.status = 404; throw e; }
  const c = await dados.carregarBases(forcar);
  const { alunos, duplicadas } = dados.juntarAlunos(c.bases, estado.mapa, estado.vinculos);
  const contexto = contextoTurma(alunos);
  const fatos = alunos.map((a) => fatosAluno(a, contexto));
  fatos.forEach((f, i) => { f.chave = alunos[i].chave; });
  const turma = fatosTurma(alunos, contexto, fatos);
  return { estado, alunos, duplicadas, contexto, fatos, turma, status: c.status };
}
function resumoAluno(a, f, estado) {
  const d = estado.dossies?.[a.chave];
  const pad = estado.padlet?.[a.chave];
  return {
    chave: a.chave, nome: a.nome, matricula: a.matricula, entregues: a.entregues, faltam: a.faltam, completo: a.completo,
    juncao: a.juncao, notas: f.notas, media: f.mediaAluno, tendencia: f.tendencia, derivas: f.derivas, reformulacoes: f.reformulacoes,
    padlet: pad ? { url: pad.url || '', conferido: Boolean(pad.verificacao), faltamNoPadlet: pad.verificacao?.faltamNoPadlet || [], em: pad.em || '' } : null,
    dossie: d ? { geradoEm: d.em, modelo: d.modelo, desatualizado: false } : null
  };
}

app.post('/api/turmas/abrir', async (req, res) => {
  try {
    const nome = String(req.body?.nome || '').trim(); const mapa = req.body?.mapa || {};
    if (!nome) throw Object.assign(new Error('Informe o nome da turma.'), { status: 400 });
    if (!Object.values(mapa).some(Boolean)) throw Object.assign(new Error('Escolha a turma em pelo menos uma P.'), { status: 400 });
    const chave = chaveTurma(nome);
    await db.alterarTurma(chave, (t) => { t.nome = nome; t.mapa = Object.fromEntries(ORDEM_P.map((id) => [id, mapa[id] || ''])); t.atualizadaEm = new Date().toISOString(); });
    res.json({ chave });
  } catch (e) { erro(res, e); }
});

app.get('/api/turmas/:chave', async (req, res) => {
  try {
    const m = await montarTurma(req.params.chave, { forcar: req.query.atualizar === '1' });
    const alunos = m.alunos.map((a) => resumoAluno(a, m.fatos.find((f) => f.chave === a.chave), m.estado));
    for (const x of alunos) { const d = m.estado.dossies?.[x.chave]; if (d) x.dossie.desatualizado = d.hashDados !== hashDadosAluno(m, x.chave); }
    res.json({ chave: req.params.chave, nome: m.estado.nome, mapa: m.estado.mapa, status: m.status, alunos, duplicadas: m.duplicadas, turma: m.turma, temas: TEMAS, relatorio: m.estado.relatorio ? { geradoEm: m.estado.relatorio.em, modelo: m.estado.relatorio.modelo } : null });
  } catch (e) { erro(res, e); }
});

// Vincula manualmente uma avaliação de uma P a um aluno (quando o nome ou a matrícula não bateram).
app.post('/api/turmas/:chave/vinculos', async (req, res) => {
  try {
    const { p, avaliacaoId, aluno } = req.body || {};
    if (!ORDEM_P.includes(p) || !avaliacaoId) throw Object.assign(new Error('Dados do vínculo incompletos.'), { status: 400 });
    await db.alterarTurma(req.params.chave, (t) => { if (aluno) t.vinculos[`${p}:${avaliacaoId}`] = aluno; else delete t.vinculos[`${p}:${avaliacaoId}`]; });
    res.json({ ok: true });
  } catch (e) { erro(res, e); }
});

// ---------- Padlet ----------
function dadosDoAluno(m, chave) {
  const aluno = m.alunos.find((a) => a.chave === chave);
  if (!aluno) throw Object.assign(new Error('Aluno não encontrado nesta turma.'), { status: 404 });
  return { aluno, fatos: m.fatos.find((f) => f.chave === chave) };
}
app.post('/api/turmas/:chave/alunos/:aluno/padlet', async (req, res) => {
  try {
    const m = await montarTurma(req.params.chave);
    const { aluno, fatos } = dadosDoAluno(m, req.params.aluno);
    const url = String(req.body?.url || m.estado.padlet?.[aluno.chave]?.url || '').trim();
    let bruto = req.body?.conteudo || null;
    if (!bruto && url && padlet.apiConfigurada()) bruto = await padlet.lerPelaApi(url);
    const verificacao = bruto ? padlet.verificar(bruto, aluno, fatos) : null;
    await db.alterarTurma(req.params.chave, (t) => { t.padlet[aluno.chave] = { url, verificacao: verificacao || t.padlet[aluno.chave]?.verificacao || null, em: verificacao ? new Date().toISOString() : (t.padlet[aluno.chave]?.em || '') }; });
    res.json({ url, verificacao, aviso: !bruto && url ? (padlet.apiConfigurada() ? '' : 'Link salvo. Para conferir o conteúdo, configure PADLET_API_KEY ou importe a leitura do Padlet.') : '' });
  } catch (e) { erro(res, e); }
});
// Importa a conferência de vários Padlets de uma vez: [{aluno|nome, url, conteudo}]
app.post('/api/turmas/:chave/padlet-lote', async (req, res) => {
  try {
    const m = await montarTurma(req.params.chave);
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const feitos = [], naoEncontrados = [];
    const updates = [];
    for (const it of itens) {
      const aluno = m.alunos.find((a) => a.chave === it.aluno) || m.alunos.find((a) => dados.normNome(a.nome) === dados.normNome(it.nome)) || m.alunos.find((a) => dados.nomesParecidos(a.nome, it.nome || ''));
      if (!aluno) { naoEncontrados.push(it.nome || it.aluno); continue; }
      const fatos = m.fatos.find((f) => f.chave === aluno.chave);
      updates.push({ chave: aluno.chave, url: it.url || '', verificacao: it.conteudo ? padlet.verificar(it.conteudo, aluno, fatos) : null });
      feitos.push(aluno.nome);
    }
    await db.alterarTurma(req.params.chave, (t) => {
      for (const u of updates) {
        const antes = t.padlet[u.chave] || {};
        const url = u.url || antes.url || '';
        // só a lista de links: mantém a conferência anterior se o link não mudou
        const manter = !u.verificacao && antes.verificacao && antes.url === url;
        t.padlet[u.chave] = { url, verificacao: u.verificacao || (manter ? antes.verificacao : null), em: u.verificacao ? new Date().toISOString() : (manter ? antes.em : '') };
      }
    });
    res.json({ feitos, naoEncontrados });
  } catch (e) { erro(res, e); }
});

// ---------- Dossiê ----------
function hashDadosAluno(m, chave) {
  const { aluno, fatos } = dadosDoAluno(m, chave);
  return hash({ ps: aluno.ps, fatos, padlet: m.estado.padlet?.[chave]?.verificacao || null, v: VERSAO_PROMPT });
}
function pacoteDossie(m, chave, d) {
  const { aluno, fatos } = dadosDoAluno(m, chave);
  return {
    aluno: { chave, nome: aluno.nome, matricula: aluno.matricula, entregues: aluno.entregues, faltam: aluno.faltam, completo: aluno.completo, orientadores: fatos.orientadores },
    fatos, turma: { mediaPorP: m.contexto.mediaPorP, temas: m.contexto.temasTurma, mediaGeral: m.contexto.mediaGeral },
    entregas: ORDEM_P.filter((id) => aluno.ps[id]).map((id) => ({ p: id, titulo: P[id].titulo, total: aluno.ps[id].total, completa: aluno.ps[id].completa, desafio: aluno.ps[id].desafio })),
    padlet: m.estado.padlet?.[chave] || null, temas: TEMAS,
    dossie: d ? { ...d.conteudo, geradoEm: d.em, modelo: d.modelo, desatualizado: d.hashDados !== hashDadosAluno(m, chave) } : null
  };
}
app.get('/api/turmas/:chave/alunos/:aluno', async (req, res) => {
  try { const m = await montarTurma(req.params.chave); res.json(pacoteDossie(m, req.params.aluno, m.estado.dossies?.[req.params.aluno])); } catch (e) { erro(res, e); }
});
app.post('/api/turmas/:chave/alunos/:aluno/dossie', async (req, res) => {
  try {
    if (!req.ia.configurada) throw Object.assign(new Error(`${req.ia.variavelChave} não configurada: o dossiê precisa de IA.`), { status: 401 });
    const m = await montarTurma(req.params.chave);
    const { aluno, fatos } = dadosDoAluno(m, req.params.aluno);
    const hd = hashDadosAluno(m, aluno.chave);
    const atual = m.estado.dossies?.[aluno.chave];
    // Mesmos dados, mesmo dossiê: só gera de novo quando os dados mudaram ou o professor pede.
    if (atual && atual.hashDados === hd && !req.body?.forcar) return res.json(pacoteDossie(m, aluno.chave, atual));
    const bruto = await chamarIA(montarPromptDossie(aluno, fatos, m.estado.padlet?.[aluno.chave]?.verificacao || null), 0, { config: req.ia });
    const registro = { conteudo: limparDossie(bruto), em: new Date().toISOString(), modelo: `${req.ia.nome} · ${req.ia.modelo}`, hashDados: hd };
    await db.alterarTurma(req.params.chave, (t) => { t.dossies[aluno.chave] = registro; });
    res.json(pacoteDossie(m, aluno.chave, registro));
  } catch (e) { erro(res, e, 502); }
});

// ---------- Relatório da turma ----------
app.get('/api/turmas/:chave/relatorio', async (req, res) => {
  try {
    const m = await montarTurma(req.params.chave);
    res.json({ nome: m.estado.nome, turma: m.turma, temas: TEMAS, mediaPorP: m.contexto.mediaPorP, matriz: m.alunos.map((a) => ({ nome: a.nome, notas: m.fatos.find((f) => f.chave === a.chave).notas, completo: a.completo })), relatorio: m.estado.relatorio });
  } catch (e) { erro(res, e); }
});
app.post('/api/turmas/:chave/relatorio', async (req, res) => {
  try {
    if (!req.ia.configurada) throw Object.assign(new Error(`${req.ia.variavelChave} não configurada: o relatório precisa de IA.`), { status: 401 });
    const m = await montarTurma(req.params.chave);
    const resumos = m.alunos.map((a) => {
      const f = m.fatos.find((x) => x.chave === a.chave); const d = m.estado.dossies?.[a.chave]?.conteudo;
      return { nome: a.nome, entregues: a.entregues, notas: f.notas, media: f.mediaAluno, tendencia: f.tendencia, desafio: (a.ps.P1?.desafio || f.fioDesafio[0]?.desafio || '').slice(0, 260), publico: (f.publicos[0]?.publico || '').slice(0, 160), persistentes: f.persistentes.map((p) => p.tema), superados: f.superados.map((p) => p.tema), derivas: f.derivas, reformulacoes: f.reformulacoes, ia: f.iaSim, padletFaltando: m.estado.padlet?.[a.chave]?.verificacao?.faltamNoPadlet || null, sinteseDossie: d ? d.sintese.slice(0, 600) : null, verificacoes: d ? Object.fromEntries(Object.entries(d.verificacoes).map(([k, v]) => [k, v.resposta])) : null };
    });
    const hd = hash({ turma: m.turma, resumos, v: VERSAO_PROMPT });
    if (m.estado.relatorio && m.estado.relatorio.hashDados === hd && !req.body?.forcar) return res.json({ relatorio: m.estado.relatorio });
    const bruto = await chamarIA(montarPromptTurma(m.estado.nome, m.turma, resumos), 0, { config: req.ia });
    const registro = { conteudo: limparTurma(bruto), em: new Date().toISOString(), modelo: `${req.ia.nome} · ${req.ia.modelo}`, hashDados: hd };
    await db.alterarTurma(req.params.chave, (t) => { t.relatorio = registro; });
    res.json({ relatorio: registro });
  } catch (e) { erro(res, e, 502); }
});

app.use((err, _req, res, _next) => res.status(500).json({ erro: err.message || 'Erro interno.' }));
if (require.main === module) app.listen(PORT, () => console.log(`Fechamento do Portfólio em http://localhost:${PORT}`));
module.exports = { app, chaveTurma };
