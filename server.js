require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const dados = require('./dados');
const padlet = require('./padlet');
const { fatosAluno, fatosTurma, contextoTurma } = require('./fatos');
const { montarPromptDossie, montarPromptTurma, limparDossie, limparTurma, montarPromptCorrecoes, limparCorrecoes, montarPromptDevolutiva, limparDevolutiva, montarPromptParecer, limparParecer } = require('./prompts');
const { P, ORDEM_P, TEMAS } = require('./fontes');
const { configIA, configDaRequisicao, chamarIA, statusIA } = require('./ia');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_USERNAME = process.env.APP_USERNAME || 'professor';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const VERSAO_PROMPT = 'v5';
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
    res.json({ atualizadoEm: new Date(c.em).toISOString(), opcoes: dados.opcoesPorP(c.bases), status: Object.fromEntries(ORDEM_P.map((id) => [id, { ...c.status[id], repo: P[id].repo, titulo: P[id].titulo }])), turmas: dados.listarTurmas(c.bases), abertas: await db.listar() });
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
    juncao: a.juncao, notas: f.notas, media: f.mediaAluno, mediaEntregues: f.mediaEntregues, perfil: f.perfil.rotulo, tendencia: f.tendencia, derivas: f.derivas, reformulacoes: f.reformulacoes,
    padlet: pad ? { url: pad.url || '', conferido: Boolean(pad.verificacao), faltamNoPadlet: pad.verificacao?.faltamNoPadlet || [], em: pad.em || '' } : null,
    dossie: d ? { geradoEm: d.em, modelo: d.modelo, etapa: d.etapa || 'preliminar', desatualizado: false } : null,
    correcoes: estado.correcoes?.[a.chave]?.conteudo ? { taxa: estado.correcoes[a.chave].conteudo.taxa, conta: estado.correcoes[a.chave].conteudo.conta } : null,
    padletLido: Boolean(pad && pad.versoes && Object.keys(pad.versoes).length)
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
    const c = await dados.carregarBases();
    const sugestao = dados.sugerirTurmas(c.bases, m.estado.nome);
    const novas = Object.fromEntries(ORDEM_P.filter((id) => !m.estado.mapa[id] && sugestao[id]).map((id) => [id, sugestao[id]]));
    // quantas avaliações de cada P entram neste fechamento
    const contagem = Object.fromEntries(ORDEM_P.map((id) => {
      const t = c.bases[id].turmas.find((x) => x.id === m.estado.mapa[id]);
      return [id, { turma: t ? t.nome : '', avaliacoes: t ? (t.avaliacoes || []).length : 0, consideradas: m.alunos.filter((a) => a.ps[id]).length }];
    }));
    res.json({ chave: req.params.chave, nome: m.estado.nome, mapa: m.estado.mapa, contagem, opcoes: dados.opcoesPorP(c.bases), sugestoesNovas: novas, status: m.status, alunos, duplicadas: m.duplicadas, turma: m.turma, temas: TEMAS, relatorio: m.estado.relatorio ? { geradoEm: m.estado.relatorio.em, modelo: m.estado.relatorio.modelo } : null });
  } catch (e) { erro(res, e); }
});

// Troca as Ps ligadas ao fechamento (por exemplo, quando a turma passou a existir na P1 ou na P5).
app.put('/api/turmas/:chave/mapa', async (req, res) => {
  try {
    const mapa = req.body?.mapa || {};
    if (!Object.values(mapa).some(Boolean)) throw Object.assign(new Error('Escolha a turma em pelo menos uma P.'), { status: 400 });
    const existe = await db.lerTurma(req.params.chave);
    if (!existe) throw Object.assign(new Error('Fechamento não encontrado.'), { status: 404 });
    await db.alterarTurma(req.params.chave, (t) => { t.mapa = Object.fromEntries(ORDEM_P.map((id) => [id, mapa[id] || ''])); t.atualizadaEm = new Date().toISOString(); });
    res.json({ ok: true });
  } catch (e) { erro(res, e); }
});
app.delete('/api/turmas/:chave', async (req, res) => {
  try { await db.excluirTurma(req.params.chave); res.json({ ok: true }); } catch (e) { erro(res, e); }
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
    let avisoLeitura = '';
    if (!bruto && url) {
      try { bruto = padlet.apiConfigurada() ? await padlet.lerPelaApi(url) : await padlet.lerPublico(url); }
      catch (e) { avisoLeitura = `Link salvo, mas não consegui ler o Padlet: ${e.message} Peça ao estudante para deixar o Padlet visível para quem tem o link, ou peça ao Claude para conferir.`; }
    }
    const verificacao = bruto ? padlet.verificar(bruto, aluno, fatos) : null;
    const versoes = bruto ? await padlet.lerVersoes(padlet.postsPorP(bruto)) : null;
    await db.alterarTurma(req.params.chave, (t) => { const antes = t.padlet[aluno.chave] || {}; t.padlet[aluno.chave] = { url, verificacao: verificacao || antes.verificacao || null, versoes: versoes || antes.versoes || null, em: verificacao ? new Date().toISOString() : (antes.em || '') }; });
    res.json({ url, verificacao, lidas: versoes ? Object.keys(versoes).length : 0, aviso: avisoLeitura });
  } catch (e) { erro(res, e); }
});
// Testa a leitura de um Padlet público sem gravar nada (diagnóstico).
app.post('/api/padlet/testar', async (req, res) => {
  try { const r = await padlet.lerPublico(String(req.body?.url || '')); res.json({ ok: true, titulo: r.titulo, secoes: r.secoes.map((s) => s.titulo), posts: r.posts.length, comAnexo: r.posts.filter((p) => p.anexo).length, porP: Object.fromEntries(Object.entries(padlet.postsPorP(r) || {}).map(([k, v]) => [k, v.posts.length])) }); }
  catch (e) { res.json({ ok: false, erro: e.message }); }
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
      updates.push({ chave: aluno.chave, url: it.url || '', verificacao: it.conteudo ? padlet.verificar(it.conteudo, aluno, fatos) : null, versoes: it.conteudo ? await padlet.lerVersoes(padlet.postsPorP(it.conteudo)) : null });
      feitos.push(aluno.nome);
    }
    await db.alterarTurma(req.params.chave, (t) => {
      for (const u of updates) {
        const antes = t.padlet[u.chave] || {};
        const url = u.url || antes.url || '';
        // só a lista de links: mantém a conferência anterior se o link não mudou
        const manter = !u.verificacao && antes.verificacao && antes.url === url;
        t.padlet[u.chave] = { url, verificacao: u.verificacao || (manter ? antes.verificacao : null), versoes: u.versoes || (manter ? antes.versoes : null) || null, em: u.verificacao ? new Date().toISOString() : (manter ? antes.em : '') };
      }
    });
    res.json({ feitos, naoEncontrados });
  } catch (e) { erro(res, e); }
});

// ---------- Dossiê ----------
function hashDadosAluno(m, chave) {
  const { aluno, fatos } = dadosDoAluno(m, chave);
  return hash({ ps: aluno.ps, fatos, padlet: m.estado.padlet?.[chave]?.verificacao || null, versoes: m.estado.padlet?.[chave]?.versoes || null, v: VERSAO_PROMPT });
}
// Resumo leve das versões do Padlet (sem o texto inteiro) para a tela.
function resumoVersoes(v) {
  if (!v) return null;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { fontes: x.fontes, links: x.links.length, caracteres: x.texto.length, temTextoLido: x.temTextoLido }]));
}
// Verifica as correções (indicações do orientador × versões do Padlet), com cache pelos mesmos dados.
async function verificarCorrecoes(req, m, aluno, forcar = false) {
  const versoes = m.estado.padlet?.[aluno.chave]?.versoes;
  if (!versoes || !Object.keys(versoes).length) return null;
  const hc = hash({ ps: aluno.ps, versoes, v: VERSAO_PROMPT });
  const atual = m.estado.correcoes?.[aluno.chave];
  if (atual && atual.hashDados === hc && !forcar) return atual.conteudo;
  const sinais = { P2: padlet.sinaisMidia(aluno.ps.P2, versoes.P2, 'linkVideo'), P4: padlet.sinaisMidia(aluno.ps.P4, versoes.P4, 'linkPodcast') };
  const bruto = await chamarIA(montarPromptCorrecoes(aluno, versoes, sinais), 0, { config: req.ia });
  const registro = { conteudo: { ...limparCorrecoes(bruto), sinaisMidia: sinais }, em: new Date().toISOString(), modelo: `${req.ia.nome} · ${req.ia.modelo}`, hashDados: hc };
  await db.alterarTurma(req.params.chave, (t) => { t.correcoes = t.correcoes || {}; t.correcoes[aluno.chave] = registro; });
  m.estado.correcoes = { ...(m.estado.correcoes || {}), [aluno.chave]: registro };
  return registro.conteudo;
}
function pacoteDossie(m, chave, d) {
  const { aluno, fatos } = dadosDoAluno(m, chave);
  return {
    aluno: { chave, nome: aluno.nome, matricula: aluno.matricula, entregues: aluno.entregues, faltam: aluno.faltam, completo: aluno.completo, orientadores: fatos.orientadores },
    fatos, turma: { mediaPorP: m.contexto.mediaPorP, temas: m.contexto.temasTurma, mediaGeral: m.contexto.mediaGeral },
    entregas: ORDEM_P.filter((id) => aluno.ps[id]).map((id) => ({ p: id, titulo: P[id].titulo, total: aluno.ps[id].total, completa: aluno.ps[id].completa, desafio: aluno.ps[id].desafio })),
    padlet: m.estado.padlet?.[chave] ? { ...m.estado.padlet[chave], versoes: undefined, versoesResumo: resumoVersoes(m.estado.padlet[chave].versoes) } : null, temas: TEMAS,
    correcoes: m.estado.correcoes?.[chave]?.conteudo || null,
    devolutiva: m.estado.devolutivas?.[chave] ? { ...m.estado.devolutivas[chave].conteudo, pendenciasBase: m.estado.devolutivas[chave].pendencias, geradoEm: m.estado.devolutivas[chave].em, modelo: m.estado.devolutivas[chave].modelo, desatualizada: Boolean(d && m.estado.devolutivas[chave].dossieEm !== d.em) } : null,
    banca: m.estado.bancas?.[chave] || null,
    dossie: d ? { ...d.conteudo, etapa: d.etapa || 'preliminar', geradoEm: d.em, modelo: d.modelo, desatualizado: d.hashDados !== hashDadosAluno(m, chave) } : null
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
    const correcoes = await verificarCorrecoes(req, m, aluno, Boolean(req.body?.forcar));
    const versoes = m.estado.padlet?.[aluno.chave]?.versoes || null;
    const bruto = await chamarIA(montarPromptDossie(aluno, fatos, m.estado.padlet?.[aluno.chave]?.verificacao || null, correcoes, versoes), 0, { config: req.ia });
    const registro = { conteudo: limparDossie(bruto), etapa: correcoes ? 'final' : 'preliminar', em: new Date().toISOString(), modelo: `${req.ia.nome} · ${req.ia.modelo}`, hashDados: hd };
    await db.alterarTurma(req.params.chave, (t) => { t.dossies[aluno.chave] = registro; });
    res.json(pacoteDossie(m, aluno.chave, registro));
  } catch (e) { erro(res, e, 502); }
});

// ---------- Devolutiva ao estudante ----------
// Pendências objetivas: Ps não entregues e indicações do orientador não atendidas (ou só em parte) no Padlet.
function pendenciasDoAluno(m, aluno) {
  const lista = aluno.faltam.filter((id) => m.contexto.psAtivas?.includes(id)).map((id) => ({ p: id, tipo: 'nao_entregue', texto: `${id} (${P[id].titulo}) não foi entregue.` }));
  const c = m.estado.correcoes?.[aluno.chave]?.conteudo;
  if (c) for (const [p, x] of Object.entries(c.porP || {})) for (const i of x.itens || []) if (i.status === 'nao_corrigido' || i.status === 'parcial') lista.push({ p, tipo: i.status, texto: `${i.indicacao}${i.status === 'parcial' ? ' (atendida só em parte)' : ''}` });
  const pad = m.estado.padlet?.[aluno.chave]?.verificacao;
  if (pad?.faltamNoPadlet?.length) lista.push({ p: '', tipo: 'padlet', texto: `Ainda não aparecem no Padlet: ${pad.faltamNoPadlet.join(', ')}.` });
  return lista;
}
app.post('/api/turmas/:chave/alunos/:aluno/devolutiva', async (req, res) => {
  try {
    if (!req.ia.configurada) throw Object.assign(new Error(`${req.ia.variavelChave} não configurada: a devolutiva precisa de IA.`), { status: 401 });
    const m = await montarTurma(req.params.chave);
    const { aluno, fatos } = dadosDoAluno(m, req.params.aluno);
    const d = m.estado.dossies?.[aluno.chave];
    if (!d) throw Object.assign(new Error('Gere o dossiê primeiro: a devolutiva é escrita a partir dele.'), { status: 400 });
    const pendencias = pendenciasDoAluno(m, aluno);
    const bruto = await chamarIA(montarPromptDevolutiva(aluno, fatos, d.conteudo, pendencias.map((x) => `${x.p ? x.p + ': ' : ''}${x.texto}`)), 0.2, { config: req.ia });
    const registro = { conteudo: limparDevolutiva(bruto), pendencias, dossieEm: d.em, etapa: d.etapa || 'preliminar', em: new Date().toISOString(), modelo: `${req.ia.nome} · ${req.ia.modelo}` };
    await db.alterarTurma(req.params.chave, (t) => { t.devolutivas = t.devolutivas || {}; t.devolutivas[aluno.chave] = registro; });
    m.estado.devolutivas = { ...(m.estado.devolutivas || {}), [aluno.chave]: registro };
    res.json(pacoteDossie(m, aluno.chave, d));
  } catch (e) { erro(res, e, 502); }
});

// ---------- Roteiro de arguição e parecer final ----------
const textoCurto = (v, n) => String(v ?? '').slice(0, n);
app.put('/api/turmas/:chave/alunos/:aluno/banca', async (req, res) => {
  try {
    const b = req.body || {};
    const anot = { data: textoCurto(b.data, 40), membros: textoCurto(b.membros, 600), geral: textoCurto(b.geral, 8000), encaminhamento: ['aprovado', 'aprovado_ajustes', 'nao_aprovado', 'a_definir'].includes(b.encaminhamento) ? b.encaminhamento : 'a_definir', respostas: (Array.isArray(b.respostas) ? b.respostas : []).slice(0, 12).map((r) => ({ marca: ['bem', 'parcial', 'nao'].includes(r?.marca) ? r.marca : '', notas: textoCurto(r?.notas, 4000) })), salvoEm: new Date().toISOString() };
    await db.alterarTurma(req.params.chave, (t) => { t.bancas = t.bancas || {}; t.bancas[req.params.aluno] = { ...(t.bancas[req.params.aluno] || {}), ...anot }; });
    res.json({ salvoEm: anot.salvoEm });
  } catch (e) { erro(res, e); }
});
app.post('/api/turmas/:chave/alunos/:aluno/parecer', async (req, res) => {
  try {
    if (!req.ia.configurada) throw Object.assign(new Error(`${req.ia.variavelChave} não configurada: o parecer precisa de IA.`), { status: 401 });
    const m = await montarTurma(req.params.chave);
    const { aluno, fatos } = dadosDoAluno(m, req.params.aluno);
    const d = m.estado.dossies?.[aluno.chave];
    const banca = m.estado.bancas?.[aluno.chave];
    if (!d) throw Object.assign(new Error('Gere o dossiê primeiro.'), { status: 400 });
    if (!banca || (!banca.geral && !(banca.respostas || []).some((r) => r.marca || r.notas))) throw Object.assign(new Error('Faça anotações da arguição antes de gerar o parecer.'), { status: 400 });
    const bruto = await chamarIA(montarPromptParecer(aluno, fatos, d.conteudo, banca), 0.2, { config: req.ia });
    const parecer = { conteudo: limparParecer(bruto), em: new Date().toISOString(), modelo: `${req.ia.nome} · ${req.ia.modelo}`, baseadoEm: banca.salvoEm };
    await db.alterarTurma(req.params.chave, (t) => { t.bancas = t.bancas || {}; t.bancas[aluno.chave] = { ...(t.bancas[aluno.chave] || {}), parecer }; });
    res.json({ parecer });
  } catch (e) { erro(res, e, 502); }
});

// ---------- Relatório da turma ----------
app.get('/api/turmas/:chave/relatorio', async (req, res) => {
  try {
    const m = await montarTurma(req.params.chave);
    const correcoesPorP = Object.fromEntries(ORDEM_P.map((id) => {
      const lista = Object.values(m.estado.correcoes || {}).map((c) => c.conteudo?.porP?.[id]).filter(Boolean);
      const soma = (k) => lista.reduce((s, x) => s + (x.conta[k] || 0), 0);
      const verif = soma('corrigido') + soma('parcial') + soma('nao_corrigido');
      return [id, { alunos: lista.length, corrigido: soma('corrigido'), parcial: soma('parcial'), nao_corrigido: soma('nao_corrigido'), nova_versao: soma('nova_versao'), nao_verificavel: soma('nao_verificavel'), taxa: verif ? Math.round(((soma('corrigido') + soma('parcial') * 0.5) / verif) * 100) : null }];
    }));
    res.json({ nome: m.estado.nome, correcoesPorP, turma: m.turma, temas: TEMAS, mediaPorP: m.contexto.mediaPorP, matriz: m.alunos.map((a) => { const f = m.fatos.find((x) => x.chave === a.chave); return { nome: a.nome, notas: f.notas, completo: a.completo, media: f.mediaAluno, mediaEntregues: f.mediaEntregues, perfil: f.perfil.rotulo }; }), relatorio: m.estado.relatorio });
  } catch (e) { erro(res, e); }
});
app.post('/api/turmas/:chave/relatorio', async (req, res) => {
  try {
    if (!req.ia.configurada) throw Object.assign(new Error(`${req.ia.variavelChave} não configurada: o relatório precisa de IA.`), { status: 401 });
    const m = await montarTurma(req.params.chave);
    const resumos = m.alunos.map((a) => {
      const f = m.fatos.find((x) => x.chave === a.chave); const d = m.estado.dossies?.[a.chave]?.conteudo;
      return { nome: a.nome, entregues: a.entregues, notas: f.notas, media: f.mediaAluno, mediaEntregues: f.mediaEntregues, perfil: f.perfil.rotulo, tendencia: f.tendencia, desafio: (a.ps.P1?.desafio || f.fioDesafio[0]?.desafio || '').slice(0, 260), publico: (f.publicos[0]?.publico || '').slice(0, 160), persistentes: f.persistentes.map((p) => p.tema), superados: f.superados.map((p) => p.tema), derivas: f.derivas, reformulacoes: f.reformulacoes, ia: f.iaSim, padletFaltando: m.estado.padlet?.[a.chave]?.verificacao?.faltamNoPadlet || null, correcoes: m.estado.correcoes?.[a.chave]?.conteudo ? { taxa: m.estado.correcoes[a.chave].conteudo.taxa, conta: m.estado.correcoes[a.chave].conteudo.conta, naoCorrigidas: Object.entries(m.estado.correcoes[a.chave].conteudo.porP).flatMap(([p, x]) => x.itens.filter((i) => i.status === 'nao_corrigido').map((i) => `${p}: ${i.indicacao}`)).slice(0, 5) } : null, sinteseDossie: d ? d.sintese.slice(0, 600) : null, verificacoes: d ? Object.fromEntries(Object.entries(d.verificacoes).map(([k, v]) => [k, v.resposta])) : null };
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
