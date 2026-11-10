/* Gráficos em SVG puro (sem bibliotecas), legíveis na tela e na impressão. */
(function () {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COR = { aluno: '#1B4F72', turma: '#C9A227', grade: '#dfe6ec', texto: '#4a5a66', bom: '#1E8449', medio: '#C9A227', ruim: '#B03A2E' };
  const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  const corNota = (n) => (n === null || n === undefined ? '#e8edf1' : n >= 9 ? '#1E8449' : n >= 8 ? '#58A06C' : n >= 7 ? '#A8C66C' : n >= 6 ? '#E2B33C' : '#C0504D');

  // Linha das notas P1 a P6: aluno x média da turma.
  function linhaNotas(notas, medias, { largura = 560, altura = 230 } = {}) {
    const ps = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const m = { e: 34, d: 14, t: 16, b: 34 };
    const w = largura - m.e - m.d, h = altura - m.t - m.b;
    const x = (i) => m.e + (w * i) / 5, y = (v) => m.t + h - (h * v) / 10;
    const grade = [0, 2, 4, 6, 8, 10].map((v) => `<line x1="${m.e}" x2="${largura - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="${COR.grade}"/><text x="${m.e - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="${COR.texto}">${v}</text>`).join('');
    const serie = (vals, cor, tracejado) => {
      const pts = ps.map((p, i) => (vals[p] === null || vals[p] === undefined ? null : [x(i), y(vals[p]), vals[p]]));
      let d = '', aberto = false;
      pts.forEach((pt) => { if (!pt) { aberto = false; return; } d += `${aberto ? 'L' : 'M'}${pt[0]},${pt[1]} `; aberto = true; });
      return `<path d="${d}" fill="none" stroke="${cor}" stroke-width="2.5" ${tracejado ? 'stroke-dasharray="5 4"' : ''}/>` +
        pts.filter(Boolean).map((pt) => `<circle cx="${pt[0]}" cy="${pt[1]}" r="4" fill="${cor}"><title>${fmt(pt[2])}</title></circle>`).join('');
    };
    const rotulos = ps.map((p, i) => `<text x="${x(i)}" y="${altura - 14}" font-size="11" text-anchor="middle" fill="${COR.texto}" font-weight="700">${p}</text>`).join('');
    const valores = ps.map((p, i) => (notas[p] === null || notas[p] === undefined ? '' : `<text x="${x(i)}" y="${y(notas[p]) - 9}" font-size="10" text-anchor="middle" fill="${COR.aluno}" font-weight="700">${fmt(notas[p])}</text>`)).join('');
    return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Notas do estudante de P1 a P6 comparadas com a média da turma">${grade}${serie(medias, COR.turma, true)}${serie(notas, COR.aluno)}${valores}${rotulos}
      <g font-size="11" fill="${COR.texto}"><rect x="${m.e}" y="${altura - 10}" width="12" height="3" fill="${COR.aluno}"/><text x="${m.e + 16}" y="${altura - 6}">Estudante</text><rect x="${m.e + 90}" y="${altura - 10}" width="12" height="3" fill="${COR.turma}"/><text x="${m.e + 106}" y="${altura - 6}">Média da turma</text></g></svg>`;
  }

  // Radar dos temas (percentual alcançado): aluno x turma.
  function radar(temas, rotulos, { tamanho = 330 } = {}) {
    const chaves = Object.keys(rotulos).filter((k) => temas[k]);
    if (chaves.length < 3) return '<div class="vazio">Dados insuficientes para o radar.</div>';
    const L = tamanho + 190, c = tamanho / 2, cx = L / 2, r = tamanho / 2 - 45;
    const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / chaves.length;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * r * (v / 100), c + Math.sin(ang(i)) * r * (v / 100)];
    const aneis = [25, 50, 75, 100].map((v) => `<polygon points="${chaves.map((_, i) => pt(i, v).join(',')).join(' ')}" fill="none" stroke="${COR.grade}"/>`).join('');
    const eixos = chaves.map((_, i) => `<line x1="${cx}" y1="${c}" x2="${pt(i, 100)[0]}" y2="${pt(i, 100)[1]}" stroke="${COR.grade}"/>`).join('');
    const poli = (campo, cor, op) => `<polygon points="${chaves.map((k, i) => pt(i, temas[k][campo] ?? 0).join(',')).join(' ')}" fill="${cor}" fill-opacity="${op}" stroke="${cor}" stroke-width="2"/>`;
    const nomes = chaves.map((k, i) => {
      const [x, y] = pt(i, 118); const anc = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
      const palavras = rotulos[k].split(' '); const meio = Math.ceil(palavras.length / 2);
      return `<text x="${x}" y="${y}" font-size="10" text-anchor="${anc}" fill="${COR.texto}"><tspan x="${x}" dy="-2">${esc(palavras.slice(0, meio).join(' '))}</tspan><tspan x="${x}" dy="11">${esc(palavras.slice(meio).join(' '))} <tspan font-weight="700" fill="${COR.aluno}">${temas[k].pct}%</tspan></tspan></text>`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${tamanho}" role="img" aria-label="Desempenho por tema">${aneis}${eixos}${poli('turma', COR.turma, 0.12)}${poli('pct', COR.aluno, 0.28)}${nomes}</svg>`;
  }

  // Barras horizontais (percentuais), com rótulo e valor.
  function barras(itens, { max = 100, sufixo = '%', cor } = {}) {
    if (!itens.length) return '<div class="vazio">Sem dados.</div>';
    return `<div class="barras">${itens.map((it) => `<div class="barra"><span class="rot" title="${esc(it.rotulo)}">${esc(it.rotulo)}</span><span class="trilho"><span class="enche" style="width:${Math.max(2, Math.min(100, (it.valor / max) * 100))}%;background:${it.cor || cor || (it.valor >= 85 ? COR.bom : it.valor >= 70 ? COR.medio : COR.ruim)}"></span>${it.ref !== undefined && it.ref !== null ? `<span class="ref" style="left:${Math.min(100, (it.ref / max) * 100)}%" title="Turma: ${fmt(it.ref)}${sufixo}"></span>` : ''}</span><b>${fmt(it.valor)}${sufixo}</b></div>`).join('')}</div>`;
  }

  // Mapa de calor: alunos x Ps.
  function mapaCalor(matriz) {
    const ps = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    return `<table class="calor"><thead><tr><th>Estudante</th>${ps.map((p) => `<th>${p}</th>`).join('')}<th title="Soma das notas dividida pelas 6 Ps (P não entregue conta zero)">Média (÷6)</th><th title="Média só das Ps entregues">Média das entregues</th></tr></thead><tbody>${matriz.map((l) => {
      const soma = ps.reduce((s, p) => s + (l.notas[p] === null || l.notas[p] === undefined ? 0 : l.notas[p]), 0); const med = soma / 6;
      const ent = ps.map((p) => l.notas[p]).filter((x) => x !== null && x !== undefined); const medEnt = ent.length ? ent.reduce((a, b) => a + b, 0) / ent.length : null;
      return `<tr><td>${esc(l.nome)}${l.completo ? '' : ' <span class="tag-inc">incompleto</span>'}</td>${ps.map((p) => `<td style="background:${corNota(l.notas[p])};color:${l.notas[p] === null || l.notas[p] === undefined ? '#8a98a3' : '#fff'}">${fmt(l.notas[p])}</td>`).join('')}<td><b>${fmt(med)}</b></td><td>${fmt(medEnt)}</td></tr>`;
    }).join('')}</tbody></table><div class="legenda-calor">${[['< 6', '#C0504D'], ['6 a 6,9', '#E2B33C'], ['7 a 7,9', '#A8C66C'], ['8 a 8,9', '#58A06C'], ['9 a 10', '#1E8449'], ['não entregou', '#e8edf1']].map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;
  }

  // Funil de entregas por P.
  function funil(funilDados, total) {
    return `<div class="funil">${funilDados.map((f) => `<div class="etapa"><div class="col" style="height:${Math.max(6, (f.entregas / Math.max(total, 1)) * 120)}px"></div><b>${f.entregas}</b><span>${f.p}</span></div>`).join('')}</div>`;
  }

  // Médias por P (colunas) com mínimo e máximo.
  function colunasPorP(estat) {
    const ps = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    return `<div class="funil">${ps.map((p) => { const e = estat[p] || {}; return `<div class="etapa" title="mín. ${fmt(e.min)} · máx. ${fmt(e.max)} · mediana ${fmt(e.mediana)}"><div class="col" style="height:${Math.max(4, ((e.media || 0) / 10) * 120)}px;background:${corNota(e.media)}"></div><b>${fmt(e.media)}</b><span>${p}</span><span style="display:block;font-size:.7rem">${e.entregas ? `${e.entregas} entrega(s)` : 'sem entregas'}</span></div>`; }).join('')}</div>`;
  }

  window.Graficos = { linhaNotas, radar, barras, mapaCalor, funil, colunasPorP, corNota, fmt };
})();
