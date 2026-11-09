const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

execFileSync('node', [__dirname + '/../scripts/gerar-dados-teste.js', '/tmp/fech-teste']);
process.env.DADOS_LOCAIS = '/tmp/fech-teste';
const dados = require('../dados');
const { fatosAluno, fatosTurma, contextoTurma, sobreposicao } = require('../fatos');
const { normalizar } = require('../fontes');
const padlet = require('../padlet');
const { limparDossie, montarPromptDossie } = require('../prompts');

async function turma() {
  const c = await dados.carregarBases(true);
  const mapa = dados.sugerirTurmas(c.bases, 'Calabresa');
  const j = dados.juntarAlunos(c.bases, mapa);
  const ctx = contextoTurma(j.alunos);
  return { c, mapa, ...j, ctx, fatos: j.alunos.map((a) => fatosAluno(a, ctx)) };
}

test('lê as notas nos três formatos (scores.points, scores número, pontuacoes)', () => {
  assert.equal(normalizar('P2', { nome: 'A', scores: { videoTempo: { points: 2 } } }).criterios.find((c) => c.k === 'videoTempo').pontos, 2);
  assert.equal(normalizar('P4', { nome: 'A', scores: { producao: 3 } }).criterios.find((c) => c.k === 'producao').pct, 75);
  assert.equal(normalizar('P3', { nome: 'A', pontuacoes: { dinamica: 3 } }).criterios.find((c) => c.k === 'dinamica').pontos, 3);
  assert.equal(normalizar('P4', { nome: 'A', iaUsada: 'Sim' }).iaDeclaracao, 'Sim');
});

test('encontra a turma em todas as Ps mesmo com nomes diferentes e junta os alunos', async () => {
  const t = await turma();
  assert.ok(Object.values(t.mapa).every(Boolean));
  assert.equal(t.alunos.length, 6);
  assert.equal(t.alunos.filter((a) => a.completo).length, 5);
  const erica = t.alunos.find((a) => /rica/.test(a.nome));
  assert.equal(erica.juncao.P4.como, 'nome parecido');
  assert.deepEqual(t.alunos.find((a) => a.nome === 'Daniel Costa').faltam, ['P5', 'P6']);
});

test('fatos do aluno: deriva do desafio, mudança de público, links do relato, tendência', async () => {
  const t = await turma();
  const carla = t.fatos.find((f) => f.nome === 'Carla Mendes Oliveira');
  assert.deepEqual(carla.derivas, ['P4', 'P5', 'P6']);
  assert.ok(carla.mudancasPublico.includes('P4'));
  assert.ok(carla.tendencia < 0);
  assert.equal(carla.cruzamentoLinksP6.find((l) => l.p === 'P4').coincidem, false);
  const ana = t.fatos.find((f) => f.nome === 'Ana Paula Souza');
  assert.deepEqual(ana.derivas, []);
  assert.ok(ana.cruzamentoLinksP6.every((l) => l.coincidem));
  assert.ok(t.fatos.find((f) => /Fábio/.test(f.nome)).iaProblemas.length > 0);
  assert.ok(sobreposicao('Como podemos apoiar técnicos de manutenção', 'apoiar os técnicos da manutenção') > 0.6);
});

test('fatos da turma: funil, paradas, correlações, atenção', async () => {
  const t = await turma();
  const ft = fatosTurma(t.alunos, t.ctx, t.fatos);
  assert.equal(ft.funil.find((f) => f.p === 'P5').entregas, 5);
  assert.equal(ft.paradas.P5, 1);
  assert.ok(ft.emAtencao.some((x) => x.nome === 'Daniel Costa'));
  assert.ok(ft.correlacoes.length > 0);
  assert.ok(ft.criteriosFrageis.length && ft.criteriosFortes.length);
});

test('conferência do Padlet no formato do conector', async () => {
  const t = await turma();
  const a = t.alunos.find((x) => x.nome === 'Carla Mendes Oliveira'), f = t.fatos.find((x) => x.nome === a.nome);
  const v = padlet.verificar({ padlet: { padlet_content: { padlet_title: 'Qualificar o atendimento ao cliente', sections: [{ section_id: '1', section_title: 'Sobre mim' }, { section_id: '3', section_title: 'P1' }, { section_id: '4', section_title: 'Portfólio 2' }], posts: [{ section_id: '3', subject: '', body: '', attachment: 'https://x/p1.pdf' }, { section_id: '4', subject: 'Vídeo', body: '<p>https://youtu.be/video2</p>', attachment: '' }, { section_id: '9', subject: 'Relato de experiência', body: '', attachment: 'https://x/r.pdf' }] } } }, a, f);
  assert.deepEqual(v.faltamNoPadlet, ['P3', 'P4', 'P5']);
  assert.equal(v.porP.find((l) => l.p === 'P2').linkBateComAvaliacao, true);
  assert.equal(v.porP.find((l) => l.p === 'P6').presente, true);
  assert.equal(padlet.pDoTitulo('Portfólio III'), 'P3');
});

test('dossiê: prompt cruza as Ps e a saída é padronizada', async () => {
  const t = await turma();
  const a = t.alunos.find((x) => x.nome === 'Carla Mendes Oliveira'), f = t.fatos.find((x) => x.nome === a.nome);
  const p = montarPromptDossie(a, f, null);
  for (const k of ['P1 · Descobrindo', 'P6 · Relato', 'PERGUNTAS PARA A BANCA', 'desafio_mantido', 'FATOS CALCULADOS']) assert.ok(p.includes(k), k);
  const d = limparDossie({ verificacoes: { desafio_mantido: { resposta: 'Não', ps: ['P1', 'X9'] } }, perguntas_banca: [1, 2, 3, 4, 5, 6].map((i) => ({ pergunta: `Q${i} — teste` })) });
  assert.equal(d.verificacoes.desafio_mantido.resposta, 'nao');
  assert.deepEqual(d.verificacoes.desafio_mantido.ps, ['P1']);
  assert.equal(d.verificacoes.ia_transparente.resposta, 'sem_dados');
  assert.equal(d.perguntas_banca.length, 5);
  assert.doesNotMatch(d.perguntas_banca[0].pergunta, /—/);
});
