// Fatos calculados (sem IA): sempre os mesmos para os mesmos dados.
// São a base objetiva do dossiê e do relatório da turma; a IA interpreta a partir deles.
const { ORDEM_P, TEMAS, P } = require('./fontes');

const media = (xs) => { const v = xs.filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const mediana = (xs) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const r1 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const r2 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

// ---------- texto ----------
const STOP = new Set('a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos à às como mais menos ou seu sua seus suas meu minha meus minhas ser ter este esta estes estas esse essa esses essas isso isto aquele aquela pelo pela pelos pelas entre sobre até também já não sim muito muita muitos muitas quando onde qual quais quem cada outro outra outros outras forma podemos pode podem fazer usar uso utilizando utilizar através desafio publico público alvo'.split(' '));
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
function radicais(texto) {
  return new Set(semAcento(texto).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.slice(0, 6)));
}
// Quanto do texto menor aparece no maior (0 a 1).
function sobreposicao(a, b) {
  const A = radicais(a), B = radicais(b);
  if (!A.size || !B.size) return null;
  const comuns = [...A].filter((x) => B.has(x)).length;
  return comuns / Math.min(A.size, B.size);
}
const URL_RE = /https?:\/\/[^\s)<>"']+/gi;
function urls(texto) { return [...new Set((String(texto || '').match(URL_RE) || []).map((u) => u.replace(/[.,;]+$/, '')))]; }
const chaveUrl = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase(); } catch { return u.toLowerCase(); } };
const textoDaP = (av) => Object.values(av.textos || {}).map((t) => t.texto).join('\n');

// Desempenho por tema (percentual ponderado pelo máximo de cada critério).
function temasDe(avs) {
  const acc = {};
  for (const av of avs) for (const c of av.criterios) {
    if (c.pontos === null) continue;
    acc[c.tema] = acc[c.tema] || { obt: 0, max: 0, ps: new Set() };
    acc[c.tema].obt += c.pontos; acc[c.tema].max += c.max; acc[c.tema].ps.add(av.p);
  }
  const out = {};
  for (const [t, v] of Object.entries(acc)) out[t] = { pct: Math.round((v.obt / v.max) * 100), ps: [...v.ps] };
  return out;
}

// ---------- aluno ----------
function fatosAluno(aluno, contexto) {
  const avs = ORDEM_P.map((id) => aluno.ps[id]).filter(Boolean);
  const notas = Object.fromEntries(ORDEM_P.map((id) => [id, aluno.ps[id] ? r2(aluno.ps[id].total) : null]));
  const pres = ORDEM_P.filter((id) => notas[id] !== null);
  const mediaAluno = r2(media(pres.map((id) => notas[id])));
  // tendência: inclinação da reta das notas ao longo das Ps entregues
  let tendencia = null;
  if (pres.length >= 3) {
    const xs = pres.map((id) => ORDEM_P.indexOf(id) + 1), ys = pres.map((id) => notas[id]);
    const mx = media(xs), my = media(ys);
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    tendencia = den ? r2(num / den) : 0;
  }
  const comparacao = Object.fromEntries(ORDEM_P.map((id) => [id, notas[id] === null || contexto.mediaPorP[id] === null ? null : r2(notas[id] - contexto.mediaPorP[id])]));
  const melhor = pres.length ? pres.reduce((a, b) => (notas[b] > notas[a] ? b : a)) : null;
  const pior = pres.length ? pres.reduce((a, b) => (notas[b] < notas[a] ? b : a)) : null;

  const temas = temasDe(avs);
  for (const t of Object.keys(temas)) temas[t].turma = contexto.temasTurma[t]?.pct ?? null;

  // critérios abaixo do máximo, com a observação do avaliador
  const abaixo = avs.flatMap((av) => av.criterios.filter((c) => c.pontos !== null && c.pontos < c.max)
    .map((c) => ({ p: av.p, criterio: c.label, tema: TEMAS[c.tema], pct: c.pct, observacao: c.observacao.slice(0, 400) })));
  // temas fracos em mais de uma P (persistentes) e fracos no início mas fortes depois (superados)
  const porTemaP = {};
  for (const av of avs) for (const c of av.criterios) if (c.pontos !== null) {
    porTemaP[c.tema] = porTemaP[c.tema] || {}; const x = porTemaP[c.tema][av.p] || { o: 0, m: 0 }; x.o += c.pontos; x.m += c.max; porTemaP[c.tema][av.p] = x;
  }
  const persistentes = [], superados = [], quedas = [];
  for (const [t, ps] of Object.entries(porTemaP)) {
    const seq = ORDEM_P.filter((id) => ps[id]).map((id) => ({ p: id, pct: Math.round((ps[id].o / ps[id].m) * 100) }));
    const fracas = seq.filter((x) => x.pct < 75);
    if (fracas.length >= 2) persistentes.push({ tema: TEMAS[t], ps: fracas.map((x) => `${x.p} (${x.pct}%)`) });
    const cedo = seq.filter((x) => ['P1', 'P2', 'P3'].includes(x.p)), tarde = seq.filter((x) => ['P4', 'P5', 'P6'].includes(x.p));
    if (cedo.some((x) => x.pct < 75) && tarde.length && tarde.every((x) => x.pct >= 85)) superados.push({ tema: TEMAS[t], de: cedo.map((x) => `${x.p} ${x.pct}%`).join(', '), para: tarde.map((x) => `${x.p} ${x.pct}%`).join(', ') });
    if (cedo.length && cedo.every((x) => x.pct >= 85) && tarde.some((x) => x.pct < 70)) quedas.push({ tema: TEMAS[t], de: cedo.map((x) => `${x.p} ${x.pct}%`).join(', '), para: tarde.map((x) => `${x.p} ${x.pct}%`).join(', ') });
  }

  // fio do desafio e do público: quanto cada P retoma o desafio da primeira entrega
  const base = aluno.ps.P1?.desafio ? 'P1' : pres.find((id) => aluno.ps[id].desafio) || null;
  const desafioBase = base ? aluno.ps[base].desafio : '';
  const fioDesafio = ORDEM_P.filter((id) => aluno.ps[id]).map((id) => {
    const d = aluno.ps[id].desafio;
    const s = d && desafioBase && id !== base ? sobreposicao(desafioBase, d) : null;
    return { p: id, desafio: d.slice(0, 500), semelhancaComBase: s === null ? null : Math.round(s * 100) };
  });
  const derivas = fioDesafio.filter((x) => x.semelhancaComBase !== null && x.semelhancaComBase < 30).map((x) => x.p);
  const publicos = ORDEM_P.filter((id) => aluno.ps[id]?.publico).map((id) => ({ p: id, publico: aluno.ps[id].publico.slice(0, 300) }));
  const publicoBase = publicos[0]?.publico || '';
  const mudancasPublico = publicos.slice(1).filter((x) => { const s = sobreposicao(publicoBase, x.publico); return s !== null && s < 0.25; }).map((x) => x.p);

  // IA ao longo do curso
  const ia = ORDEM_P.filter((id) => aluno.ps[id]).map((id) => ({ p: id, declaracao: aluno.ps[id].iaDeclaracao || 'sem registro', descricao: aluno.ps[id].iaDescricao.slice(0, 300) }));
  const iaSim = ia.filter((x) => x.declaracao === 'Sim').map((x) => x.p);
  const iaProblemas = ia.filter((x) => x.declaracao === 'Ambos' || (x.declaracao === 'Sim' && x.descricao.length < 25)).map((x) => x.p);

  // orientador informado em cada P
  const orientadores = [...new Set(avs.map((a) => a.orientador).filter(Boolean).map((o) => o.replace(/^prof(a|\.|essora|essor)?\.?\s*/i, '').trim()))];

  // links: o que cada P registrou e se o relato (P6) aponta para os mesmos produtos
  const linksPorP = Object.fromEntries(avs.map((a) => [a.p, urls(textoDaP(a))]));
  const cruzamentoLinksP6 = [];
  if (aluno.ps.P6) for (const id of ['P2', 'P3', 'P4', 'P5']) {
    const ref = aluno.ps.P6.textos[`recurso${id}`]?.texto || '';
    const noRelato = urls(ref).map(chaveUrl), naP = (linksPorP[id] || []).map(chaveUrl);
    if (!noRelato.length && !naP.length) continue;
    cruzamentoLinksP6.push({ p: id, linksNoRelato: noRelato.length, linksNaP: naP.length, coincidem: noRelato.some((u) => naP.includes(u)), relatoComentaAP: ref.length > 80 });
  }

  const alertas = avs.flatMap((a) => a.alertas.map((t) => ({ p: a.p, alerta: t.slice(0, 220) })));
  const pendentes = avs.filter((a) => !a.completa).map((a) => a.p);
  return {
    nome: aluno.nome, matricula: aluno.matricula, entregues: aluno.entregues, faltam: aluno.faltam, completo: aluno.completo,
    notas, mediaAluno, mediaTurma: contexto.mediaGeral, comparacao, tendencia, melhor, pior,
    temas, abaixo, persistentes, superados, quedas,
    fioDesafio, derivas, publicos, mudancasPublico,
    ia, iaSim, iaProblemas, orientadores, linksPorP, cruzamentoLinksP6,
    coerenciaP1: aluno.ps.P1 ? { etiqueta: aluno.ps.P1.textos.coerenciaEtiqueta?.texto || '', motivo: aluno.ps.P1.textos.coerenciaMotivo?.texto || '' } : null,
    alertas, avaliacoesPendentes: pendentes
  };
}

// ---------- turma ----------
function pearson(xs, ys) {
  const n = xs.length; if (n < 4) return null;
  const mx = media(xs), my = media(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0)), dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return dx && dy ? r2(num / (dx * dy)) : null;
}
function contextoTurma(alunos) {
  const mediaPorP = {}, estatPorP = {};
  for (const id of ORDEM_P) {
    const v = alunos.map((a) => a.ps[id]?.total).filter((x) => Number.isFinite(x));
    mediaPorP[id] = r2(media(v));
    estatPorP[id] = { entregas: v.length, media: r2(media(v)), mediana: r2(mediana(v)), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, abaixoDe6: v.filter((x) => x < 6).length };
  }
  const todas = alunos.flatMap((a) => ORDEM_P.map((id) => a.ps[id]).filter(Boolean));
  const temasTurma = temasDe(todas);
  const mediaGeral = r2(media(alunos.map((a) => media(ORDEM_P.map((id) => a.ps[id]?.total).filter(Number.isFinite)))));
  return { mediaPorP, estatPorP, temasTurma, mediaGeral };
}

function fatosTurma(alunos, contexto, fatosPorAluno) {
  const n = alunos.length;
  const funil = ORDEM_P.map((id) => ({ p: id, entregas: alunos.filter((a) => a.ps[id]).length }));
  const completos = alunos.filter((a) => a.completo).length;
  // onde os alunos param: primeira P que falta
  const paradas = {};
  for (const a of alunos) if (!a.completo) { const f = ORDEM_P.find((id) => !a.ps[id]); paradas[f] = (paradas[f] || 0) + 1; }
  // critérios: os mais frágeis e os mais fortes da turma
  const crit = {};
  for (const a of alunos) for (const id of ORDEM_P) { const av = a.ps[id]; if (!av) continue; for (const c of av.criterios) if (c.pontos !== null) {
    const k = `${id}|${c.k}`; crit[k] = crit[k] || { p: id, criterio: c.label, tema: TEMAS[c.tema], soma: 0, n: 0, zeros: 0, maximos: 0 };
    crit[k].soma += c.pontos / c.max; crit[k].n++; if (c.pontos === 0) crit[k].zeros++; if (c.pontos === c.max) crit[k].maximos++;
  } }
  const criterios = Object.values(crit).filter((c) => c.n >= 2).map((c) => ({ ...c, pct: Math.round((c.soma / c.n) * 100) })).map(({ soma, ...c }) => c);
  const frageis = [...criterios].sort((a, b) => a.pct - b.pct).slice(0, 8);
  const fortes = [...criterios].sort((a, b) => b.pct - a.pct).slice(0, 8);
  // alertas mais frequentes (texto normalizado)
  const alertas = {};
  for (const f of fatosPorAluno) for (const x of f.alertas) { const k = `${x.p}: ${x.alerta.slice(0, 120)}`; alertas[k] = (alertas[k] || 0) + 1; }
  const alertasFrequentes = Object.entries(alertas).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([alerta, vezes]) => ({ alerta, vezes }));
  // correlações entre as notas das Ps
  const correlacoes = [];
  for (let i = 0; i < ORDEM_P.length; i++) for (let j = i + 1; j < ORDEM_P.length; j++) {
    const a = ORDEM_P[i], b = ORDEM_P[j];
    const par = alunos.filter((x) => Number.isFinite(x.ps[a]?.total) && Number.isFinite(x.ps[b]?.total));
    const r = pearson(par.map((x) => x.ps[a].total), par.map((x) => x.ps[b].total));
    if (r !== null) correlacoes.push({ entre: `${a} e ${b}`, r, n: par.length });
  }
  correlacoes.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  const iaPorP = ORDEM_P.map((id) => ({ p: id, sim: alunos.filter((a) => a.ps[id]?.iaDeclaracao === 'Sim').length, de: alunos.filter((a) => a.ps[id]).length }));
  const comDeriva = fatosPorAluno.filter((f) => f.derivas.length).map((f) => ({ nome: f.nome, ps: f.derivas }));
  const comMudancaPublico = fatosPorAluno.filter((f) => f.mudancasPublico.length).map((f) => ({ nome: f.nome, ps: f.mudancasPublico }));
  const tendencias = fatosPorAluno.filter((f) => f.tendencia !== null);
  const emAtencao = fatosPorAluno.filter((f) => (f.mediaAluno !== null && f.mediaAluno < 6) || (f.tendencia !== null && f.tendencia <= -0.5) || f.persistentes.length >= 3)
    .map((f) => ({ nome: f.nome, media: f.mediaAluno, tendencia: f.tendencia, persistentes: f.persistentes.map((p) => p.tema) }));
  const destaques = fatosPorAluno.filter((f) => f.completo && f.mediaAluno !== null && f.mediaAluno >= 9).map((f) => ({ nome: f.nome, media: f.mediaAluno }));
  const persistentesTurma = {};
  for (const f of fatosPorAluno) for (const p of f.persistentes) persistentesTurma[p.tema] = (persistentesTurma[p.tema] || 0) + 1;
  const superadosTurma = {};
  for (const f of fatosPorAluno) for (const p of f.superados) superadosTurma[p.tema] = (superadosTurma[p.tema] || 0) + 1;
  return {
    alunos: n, completos, funil, paradas, estatPorP: contexto.estatPorP, mediaGeral: contexto.mediaGeral, temas: contexto.temasTurma,
    criteriosFrageis: frageis, criteriosFortes: fortes, alertasFrequentes, correlacoes: correlacoes.slice(0, 6), iaPorP,
    comDeriva, comMudancaPublico, emAtencao, destaques,
    melhoraram: tendencias.filter((f) => f.tendencia >= 0.3).length, pioraram: tendencias.filter((f) => f.tendencia <= -0.3).length, estaveis: tendencias.filter((f) => Math.abs(f.tendencia) < 0.3).length,
    persistentesTurma, superadosTurma
  };
}

module.exports = { fatosAluno, fatosTurma, contextoTurma, sobreposicao, urls, temasDe, TEMAS, P };
