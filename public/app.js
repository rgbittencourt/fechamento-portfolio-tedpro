/* Fechamento do Portfólio · TEDPRO */
(function () {
  'use strict';
  const G = window.Graficos;
  const PS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const NOMES_P = { P1: 'Descobrindo meu desafio', P2: 'Roteiro e vídeo', P3: 'Proposta formativa', P4: 'Podcast', P5: 'Agente de IA', P6: 'Relato de experiência' };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = G.fmt;
  const app = $('#app');
  let auth = sessionStorage.getItem('fechAuth') || '';

  async function api(url, op = {}) {
    const headers = { ...(op.headers || {}), ...(window.SeletorIA ? SeletorIA.cabecalho() : {}) };
    if (auth) headers.Authorization = auth;
    if (op.body) headers['Content-Type'] = 'application/json';
    let r = await fetch(url, { ...op, headers });
    if (r.status === 401 && r.headers.get('X-Login-Necessario')) {
      const login = await SeletorIA.pedirLogin('professor'); if (!login) throw new Error('Autenticação cancelada.');
      auth = SeletorIA.basic(login.usuario, login.senha); sessionStorage.setItem('fechAuth', auth);
      r = await fetch(url, { ...op, headers: { ...headers, ...SeletorIA.cabecalho(), Authorization: auth } });
      if (r.status === 401) { auth = ''; sessionStorage.removeItem('fechAuth'); SeletorIA.esquecerLogin(); throw new Error('Usuário ou senha incorretos.'); }
    }
    const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { erro: t || `Erro ${r.status}` }; }
    if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
    return d;
  }
  const chipNota = (n) => (n === null || n === undefined ? '<span class="chip vazio">—</span>' : `<span class="chip" style="background:${G.corNota(n)}">${fmt(n)}</span>`);
  const seta = (t) => (t === null || t === undefined ? '' : t >= 0.3 ? '<span class="tag ok" title="Notas subindo ao longo das Ps">▲ subindo</span>' : t <= -0.3 ? '<span class="tag ruim" title="Notas caindo ao longo das Ps">▼ caindo</span>' : '<span class="tag neutra">● estável</span>');
  const psTag = (ps) => (ps && ps.length ? `<span class="ps">[${ps.join(', ')}]</span>` : '');
  function erroNaTela(e) { app.innerHTML = `<div class="card"><div class="erro-box">${esc(e.message)}</div><div class="barra-ferr"><a class="btn sec" href="#/">Voltar ao início</a></div></div>`; }

  // ================= início =================
  async function telaInicio() {
    app.innerHTML = '<div class="card">Buscando os dados das P1 a P6…</div>';
    const f = await api('/api/fontes');
    const fontes = PS.map((p) => { const s = f.status[p] || {}; return `<span class="fonte ${s.ok ? 'ok' : 'erro'}" title="${esc(s.repo)}${s.erro ? ': ' + esc(s.erro) : ''}"><b>${p}</b> ${s.ok ? `${s.turmas} turma(s) · ${s.avaliacoes} avaliação(ões)` : 'sem acesso'}</span>`; }).join('');
    const opcoes = (p) => `<option value="">(não usar)</option>` + f.turmas.filter((t) => t.ps[p]).map((t) => `<option value="${esc(t.ps[p].id)}">${esc(t.ps[p].nome)} (${t.ps[p].quantidade})</option>`).join('');
    app.innerHTML = `
      <div class="card"><h2>Abrir o fechamento de uma turma</h2>
        <div class="hint">Digite o nome da turma (por exemplo, <b>Calabresa</b>). O app procura a turma em cada uma das seis Ps; confira e ajuste antes de abrir.</div>
        <div class="barra-ferr"><input type="text" id="pedido" placeholder="Nome da turma" style="max-width:340px"><button class="btn" id="procurar">Procurar nas Ps</button></div>
        <div id="mapaBox" class="oculto"><div class="grade6" style="margin-top:12px">${PS.map((p) => `<div><label for="m_${p}">${p} · ${NOMES_P[p]}</label><select id="m_${p}">${opcoes(p)}</select></div>`).join('')}</div>
        <label for="nomeTurma">Nome do fechamento</label><input type="text" id="nomeTurma" style="max-width:340px">
        <div class="barra-ferr"><button class="btn ouro" id="abrir">Abrir fechamento</button></div></div>
        <div id="statusAbrir" class="status"></div></div>
      ${f.abertas.length ? `<div class="card"><h2>Fechamentos já abertos</h2><table><thead><tr><th>Turma</th><th>Ps ligadas</th><th>Atualizado</th><th></th></tr></thead><tbody>${f.abertas.map((t) => `<tr><td><b>${esc(t.nome)}</b></td><td>${PS.filter((p) => t.mapa?.[p]).join(', ') || '—'}</td><td>${t.atualizadaEm ? new Date(t.atualizadaEm).toLocaleDateString('pt-BR') : ''}</td><td><a class="btn peq" href="#/turma/${encodeURIComponent(t.chave)}">Abrir</a></td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="card"><h2>Dados das Ps <button class="btn sec peq no-print" id="atualizarFontes">↻ Atualizar do GitHub</button></h2><div class="fontes">${fontes}</div><div class="hint" style="margin-top:8px">Lidos em ${new Date(f.atualizadoEm).toLocaleString('pt-BR')}.</div></div>`;
    $('#atualizarFontes').onclick = async () => { await api('/api/fontes?atualizar=1'); telaInicio(); };
    const procurar = async () => {
      const pedido = $('#pedido').value.trim(); if (!pedido) return;
      const { mapa } = await api('/api/turmas/sugerir', { method: 'POST', body: JSON.stringify({ pedido }) });
      PS.forEach((p) => { $(`#m_${p}`).value = mapa[p] || ''; });
      $('#nomeTurma').value = pedido; $('#mapaBox').classList.remove('oculto');
      const achadas = PS.filter((p) => mapa[p]).length;
      $('#statusAbrir').textContent = achadas ? `Turma encontrada em ${achadas} de 6 Ps. Confira as escolhas acima.` : 'Não encontrei uma turma com esse nome. Escolha manualmente em cada P.';
    };
    $('#procurar').onclick = procurar; $('#pedido').onkeydown = (e) => { if (e.key === 'Enter') procurar(); };
    $('#abrir').onclick = async () => {
      try {
        const mapa = Object.fromEntries(PS.map((p) => [p, $(`#m_${p}`).value]));
        const r = await api('/api/turmas/abrir', { method: 'POST', body: JSON.stringify({ nome: $('#nomeTurma').value, mapa }) });
        location.hash = `#/turma/${encodeURIComponent(r.chave)}`;
      } catch (e) { $('#statusAbrir').textContent = e.message; }
    };
  }

  // ================= turma =================
  async function telaTurma(chave, atualizar = false) {
    app.innerHTML = '<div class="card">Cruzando as P1 a P6 da turma…</div>';
    const t = await api(`/api/turmas/${encodeURIComponent(chave)}${atualizar ? '?atualizar=1' : ''}`);
    const completos = t.alunos.filter((a) => a.completo), incompletos = t.alunos.filter((a) => !a.completo);
    const juncoesDuvidosas = t.alunos.flatMap((a) => Object.entries(a.juncao).filter(([, j]) => j.como === 'nome parecido').map(([p, j]) => ({ aluno: a, p, j })));
    const linha = (a) => `<tr>
      <td><b>${esc(a.nome)}</b><div class="hint">${esc(a.matricula || 'sem matrícula')}</div></td>
      <td><div class="chips">${PS.map((p) => chipNota(a.notas[p])).join('')}</div>${a.faltam.length ? `<div class="hint">Falta: ${a.faltam.join(', ')}</div>` : ''}</td>
      <td><b>${fmt(a.media)}</b><br>${seta(a.tendencia)}</td>
      <td>${a.derivas.length ? `<span class="tag ruim" title="O desafio dessas Ps tem pouca semelhança com o da primeira entrega">muda em ${a.derivas.join(', ')}</span>` : ''}${a.reformulacoes.length ? `<span class="tag aviso" title="Mesmo tema, mas com outro recorte (público, local ou foco)">reformulado em ${a.reformulacoes.join(', ')}</span>` : ''}${!a.derivas.length && !a.reformulacoes.length ? (a.entregues.length > 1 ? '<span class="tag ok">mantido</span>' : '<span class="tag neutra">uma entrega</span>') : ''}</td>
      <td>${a.padlet ? (a.padlet.conferido ? (a.padlet.faltamNoPadlet.length ? `<span class="tag aviso">faltam ${a.padlet.faltamNoPadlet.join(', ')}</span>` : '<span class="tag ok">completo</span>') : '<span class="tag neutra">link salvo</span>') : '<span class="tag neutra">não conferido</span>'}</td>
      <td>${a.dossie ? `<span class="tag ${a.dossie.desatualizado ? 'aviso' : 'ok'}">${a.dossie.desatualizado ? 'dados mudaram' : 'pronto'}</span>` : '<span class="tag neutra">não gerado</span>'}</td>
      <td class="no-print"><a class="btn peq" href="#/turma/${encodeURIComponent(chave)}/aluno/${encodeURIComponent(a.chave)}">Abrir dossiê</a></td></tr>`;
    app.innerHTML = `
      <div class="card"><h2>${esc(t.nome)} <span class="hint">· fechamento do portfólio</span></h2>
        <div class="kpis"><div class="kpi"><small>Estudantes</small><strong>${t.alunos.length}</strong><em>com ao menos uma P avaliada</em></div>
        <div class="kpi"><small>Completaram P1 a P6</small><strong>${completos.length}</strong><em>recebem o dossiê de banca</em></div>
        <div class="kpi"><small>Média geral</small><strong>${fmt(t.turma.mediaGeral)}</strong><em>média das médias dos estudantes</em></div>
        <div class="kpi"><small>Notas subindo / caindo</small><strong>${t.turma.melhoraram} / ${t.turma.pioraram}</strong><em>tendência ao longo das Ps</em></div></div>
        <div class="barra-ferr no-print"><a class="btn ouro" href="#/turma/${encodeURIComponent(chave)}/relatorio">📊 Relatório da turma</a><button class="btn" id="gerarTodos">✨ Gerar dossiês dos que completaram</button><button class="btn sec" id="atualizarDados">↻ Atualizar dados das Ps</button><a class="btn sec" href="#/">Trocar de turma</a></div>
        <div id="statusLote" class="status"></div><div class="progresso oculto" id="progLote"><span></span></div>
        <div class="hint" style="margin-top:8px">Ps ligadas: ${PS.map((p) => `${p} ${t.mapa[p] ? '✔' : '✘'}`).join(' · ')}</div></div>
      ${juncoesDuvidosas.length || t.duplicadas.length ? `<div class="card"><h2>Conferência dos nomes</h2>
        ${juncoesDuvidosas.map((x) => `<div class="aviso-box" style="margin-bottom:6px">Na ${x.p}, "<b>${esc(x.j.nomeNaP)}</b>"${x.j.matriculaNaP ? ` (matrícula ${esc(x.j.matriculaNaP)})` : ' (sem matrícula)'} foi ligado a <b>${esc(x.aluno.nome)}</b> pelo nome parecido. <button class="btn peq sec" data-desfazer="${x.p}|${esc(x.j.avaliacaoId)}">Não é a mesma pessoa</button></div>`).join('')}
        ${t.duplicadas.map((d) => `<div class="hint">Na ${d.p}, ${esc(d.aluno)} tinha duas avaliações; ficou a mais recente.</div>`).join('')}</div>` : ''}
      <div class="card"><h2>Completaram as seis Ps (${completos.length})</h2>${completos.length ? `<div style="overflow:auto"><table><thead><tr><th>Estudante</th><th>Notas P1 a P6</th><th>Média</th><th>Fio do desafio</th><th>Padlet</th><th>Dossiê</th><th></th></tr></thead><tbody>${completos.map(linha).join('')}</tbody></table></div>` : '<div class="vazio">Ninguém completou as seis Ps nesta turma ainda.</div>'}</div>
      ${incompletos.length ? `<div class="card"><h2>Ainda não completaram (${incompletos.length})</h2><div class="hint">Também é possível abrir o dossiê, com o que já foi entregue. Se alguém aparece aqui só porque o nome ou a matrícula não bateram, junte com o estudante certo.</div><div style="overflow:auto"><table><thead><tr><th>Estudante</th><th>Notas P1 a P6</th><th>Média</th><th>Fio do desafio</th><th>Padlet</th><th>Dossiê</th><th></th></tr></thead><tbody>${incompletos.map((a) => linha(a).replace('</td></tr>', `<div style="margin-top:6px"><select data-juntar="${esc(a.chave)}" class="no-print" style="font-size:.74rem;padding:4px"><option value="">Juntar com…</option>${t.alunos.filter((b) => b.chave !== a.chave).map((b) => `<option value="${esc(b.chave)}">${esc(b.nome)}</option>`).join('')}</select></div></td></tr>`)).join('')}</tbody></table></div></div>` : ''}`;
    $('#atualizarDados').onclick = () => telaTurma(chave, true);
    app.querySelectorAll('[data-desfazer]').forEach((b) => (b.onclick = async () => { const [p, id] = b.dataset.desfazer.split('|'); await api(`/api/turmas/${encodeURIComponent(chave)}/vinculos`, { method: 'POST', body: JSON.stringify({ p, avaliacaoId: id, aluno: `separado-${p}-${id}` }) }); telaTurma(chave); }));
    app.querySelectorAll('[data-juntar]').forEach((s) => (s.onchange = async () => {
      if (!s.value) return; const de = t.alunos.find((a) => a.chave === s.dataset.juntar), para = t.alunos.find((a) => a.chave === s.value);
      if (!confirm(`Juntar as entregas de "${de.nome}" (${de.entregues.join(', ')}) com "${para.nome}"?`)) { s.value = ''; return; }
      for (const [p, j] of Object.entries(de.juncao)) await api(`/api/turmas/${encodeURIComponent(chave)}/vinculos`, { method: 'POST', body: JSON.stringify({ p, avaliacaoId: j.avaliacaoId, aluno: para.chave }) });
      telaTurma(chave);
    }));
    $('#gerarTodos').onclick = async () => {
      const alvo = completos.filter((a) => !a.dossie || a.dossie.desatualizado);
      if (!alvo.length) { $('#statusLote').textContent = 'Todos os dossiês dos que completaram já estão prontos e atualizados.'; return; }
      if (!confirm(`Gerar ${alvo.length} dossiê(s)? Cada um leva cerca de 1 minuto.`)) return;
      $('#gerarTodos').disabled = true; $('#progLote').classList.remove('oculto');
      let feitos = 0; const falhas = [];
      for (const a of alvo) {
        $('#statusLote').textContent = `Gerando o dossiê de ${a.nome} (${feitos + 1} de ${alvo.length})…`;
        try { await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(a.chave)}/dossie`, { method: 'POST', body: '{}' }); }
        catch (e) { falhas.push(`${a.nome}: ${e.message}`); }
        feitos++; $('#progLote span').style.width = `${(feitos / alvo.length) * 100}%`;
      }
      $('#statusLote').textContent = falhas.length ? `Concluído com ${falhas.length} falha(s): ${falhas.join(' | ')}` : 'Dossiês gerados.';
      setTimeout(() => telaTurma(chave), 1200);
    };
  }

  // ================= dossiê =================
  const ROT_RESP = { sim: ['✔ sim', 'ok'], parcial: ['◐ parcial', 'aviso'], nao: ['✘ não', 'ruim'], sem_dados: ['sem dados', 'neutra'] };
  async function telaAluno(chave, alunoChave) {
    app.innerHTML = '<div class="card">Montando o dossiê…</div>';
    const d = await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(alunoChave)}`);
    const f = d.fatos, x = d.dossie, a = d.aluno;
    const temasRadar = {}; for (const [k, v] of Object.entries(f.temas)) temasRadar[k] = { pct: v.pct, turma: v.turma };
    const pad = d.padlet?.verificacao;
    const gerar = `<div class="barra-ferr no-print"><button class="btn ouro" id="gerar">${x ? '↻ Gerar novamente' : '✨ Gerar dossiê com IA'}</button><button class="btn sec" onclick="window.print()">🖨 Imprimir / salvar em PDF</button><a class="btn sec" href="#/turma/${encodeURIComponent(chave)}">← Voltar à turma</a></div><div id="statusGerar" class="status">${x ? `Gerado em ${new Date(x.geradoEm).toLocaleString('pt-BR')} · ${esc(x.modelo)}${x.desatualizado ? ' · <b>os dados mudaram desde então: gere novamente</b>' : ' · mesmos dados, mesmo dossiê'}` : 'Os fatos e gráficos abaixo já estão calculados. A leitura cruzada, as verificações e as perguntas para a banca são geradas pela IA.'}</div>`;
    app.innerHTML = `<div class="dossie">
      <div class="capa"><small>Dossiê de banca · uso exclusivo dos professores</small><h2>${esc(a.nome)}</h2>
        <div>${esc(f.fioDesafio[0]?.desafio || 'Desafio não registrado')}</div>
        <div class="meta"><span><b>Matrícula:</b> ${esc(a.matricula || '—')}</span><span><b>Orientação informada:</b> ${esc(a.orientadores.join(' / ') || '—')}</span><span><b>Entregas:</b> ${a.entregues.join(', ')}${a.faltam.length ? ` (falta ${a.faltam.join(', ')})` : ''}</span><span><b>Média:</b> ${fmt(f.mediaAluno)} (turma ${fmt(f.mediaTurma)})</span></div></div>
      ${a.orientadores.length > 1 ? `<div class="aviso-box" style="margin-bottom:14px">A orientação informada muda entre as Ps: <b>${esc(a.orientadores.join(' / '))}</b>. Confira antes da banca.</div>` : ''}
      <div class="card no-print">${gerar}</div>
      ${x ? `<div class="card"><h2>Síntese</h2><div class="texto">${esc(x.sintese)}</div></div>` : ''}
      <div class="grade2"><div class="card"><h2>Notas de P1 a P6</h2>${G.linhaNotas(f.notas, d.turma.mediaPorP)}
        <div class="hint">Tendência: ${seta(f.tendencia)} ${f.melhor ? `· melhor entrega: <b>${f.melhor}</b> (${fmt(f.notas[f.melhor])})` : ''} ${f.pior ? `· mais frágil: <b>${f.pior}</b> (${fmt(f.notas[f.pior])})` : ''}</div></div>
      <div class="card"><h2>Desempenho por tema, somando todas as Ps</h2>${G.radar(temasRadar, d.temas)}<div class="hint">Azul: o estudante · dourado: média da turma. Cada tema reúne critérios de várias Ps.</div></div></div>
      <div class="card"><h2>O fio do desafio</h2>${x?.fio_do_desafio?.resumo ? `<div class="texto" style="margin-bottom:10px">${esc(x.fio_do_desafio.resumo)}</div>` : ''}
        <div class="linha-tempo">${PS.map((p) => { const e = x?.fio_do_desafio?.etapas?.find((y) => y.p === p); const fd = f.fioDesafio.find((y) => y.p === p); const entregue = a.entregues.includes(p);
          return `<div class="etp ${e?.ligacao || ''}"><b>${p}</b> · ${NOMES_P[p]}<div>${entregue ? esc(e?.o_que_fez || (fd?.desafio ? fd.desafio.slice(0, 120) + (fd.desafio.length > 120 ? '…' : '') : 'Entregue')) : '<i>não entregue</i>'}</div>${fd && fd.semelhancaComBase !== null ? `<div class="sem">Semelhança do desafio com a 1ª entrega: <b>${fd.semelhancaComBase}%</b></div>` : ''}${e?.ligacao ? `<div class="sem">Ligação com o desafio: <b>${e.ligacao}</b></div>` : ''}</div>`; }).join('')}</div>
        ${f.reformulacoes.length ? `<div class="aviso-box" style="margin-top:10px">O desafio aparece <b>reformulado</b> em <b>${f.reformulacoes.join(', ')}</b>: mesmo tema, com outro recorte. Vale conferir se a mudança foi intencional.</div>` : ''}${f.derivas.length ? `<div class="aviso-box" style="margin-top:10px">O desafio registrado em <b>${f.derivas.join(', ')}</b> tem pouca semelhança com o da primeira entrega.${f.mudancasPublico.length ? ` O público-alvo também parece mudar em <b>${f.mudancasPublico.join(', ')}</b>.` : ''}</div>` : f.mudancasPublico.length ? `<div class="aviso-box" style="margin-top:10px">O público-alvo parece mudar em <b>${f.mudancasPublico.join(', ')}</b>.</div>` : ''}</div>
      ${x ? `<div class="card"><h2>Verificações cruzadas</h2><table class="verif"><thead><tr><th>Pergunta</th><th>Resposta</th><th>Evidência</th></tr></thead><tbody>${Object.values(x.verificacoes).map((v) => `<tr><td>${esc(v.pergunta)}</td><td><span class="tag ${ROT_RESP[v.resposta][1]}">${ROT_RESP[v.resposta][0]}</span></td><td>${esc(v.evidencia)}${psTag(v.ps)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h2>Perguntas para a banca</h2>${x.perguntas_banca.map((q, i) => `<div class="perg"><div class="q">${i + 1}. ${esc(q.pergunta)}</div><div class="det"><b>Por que perguntar:</b> ${esc(q.por_que)}${psTag(q.ps)}</div><div class="det"><b>O que uma boa resposta mostraria:</b> ${esc(q.o_que_observar)}</div></div>`).join('')}</div>
      <div class="grade2"><div class="card"><h2>Pontos fortes</h2><ul class="lista-ev">${x.pontos_fortes.map((p) => `<li>${esc(p.texto)}${psTag(p.ps)}</li>`).join('')}</ul></div>
      <div class="card"><h2>Fragilidades</h2><ul class="lista-ev">${x.fragilidades.map((p) => `<li>${esc(p.texto)}${psTag(p.ps)}</li>`).join('')}</ul></div></div>
      ${x.contradicoes.length ? `<div class="card"><h2>Contradições e lacunas entre as Ps</h2><ul class="lista-ev">${x.contradicoes.map((p) => `<li>${esc(p.descricao)}${psTag(p.ps)}</li>`).join('')}</ul></div>` : ''}` : ''}
      <div class="card"><h2>Aprendizagem ao longo do curso</h2>${x?.evolucao ? `<div class="texto" style="margin-bottom:10px">${esc(x.evolucao)}</div>` : ''}
        <div class="grade3"><div><h3>Superou</h3>${f.superados.length ? f.superados.map((s) => `<div><span class="tag ok">${esc(s.tema)}</span><div class="hint">${esc(s.de)} → ${esc(s.para)}</div></div>`).join('') : '<div class="vazio">Nenhum tema fraco no início que tenha ficado forte depois.</div>'}</div>
        <div><h3>Persistiu</h3>${f.persistentes.length ? f.persistentes.map((s) => `<div><span class="tag ruim">${esc(s.tema)}</span><div class="hint">${esc(s.ps.join(', '))}</div></div>`).join('') : '<div class="vazio">Nenhum tema abaixo de 75% em mais de uma P.</div>'}</div>
        <div><h3>Caiu</h3>${f.quedas.length ? f.quedas.map((s) => `<div><span class="tag aviso">${esc(s.tema)}</span><div class="hint">${esc(s.de)} → ${esc(s.para)}</div></div>`).join('') : '<div class="vazio">Nenhum tema forte no início que tenha caído depois.</div>'}</div></div>
        <details class="det-crit"${f.abaixo.length <= 8 ? ' open' : ''}><summary><b>Critérios abaixo do máximo, com a observação do avaliador (${f.abaixo.length})</b></summary>${f.abaixo.length ? `<table><thead><tr><th>P</th><th>Critério</th><th>%</th><th>Observação do avaliador</th></tr></thead><tbody>${f.abaixo.map((c) => `<tr><td>${c.p}</td><td>${esc(c.criterio)}</td><td>${c.pct}%</td><td>${esc(c.observacao || '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="vazio">Todos os critérios avaliados no máximo.</div>'}</details></div>
      <div class="grade2"><div class="card"><h2>Uso de IA declarado</h2><table><tbody>${f.ia.map((i) => `<tr><td><b>${i.p}</b></td><td><span class="tag ${i.declaracao === 'Sim' ? 'neutra' : i.declaracao === 'Não' ? 'ok' : 'aviso'}">${esc(i.declaracao)}</span></td><td class="hint">${esc(i.descricao || '')}</td></tr>`).join('')}</tbody></table>${f.iaProblemas.length ? `<div class="aviso-box" style="margin-top:8px">Declaração contraditória ou sem descrição em ${f.iaProblemas.join(', ')}.</div>` : ''}</div>
      <div class="card"><h2>Portfólio no Padlet</h2>
        <label for="padletUrl" class="no-print">Link do Padlet do estudante</label><div class="barra-ferr no-print" style="margin-top:0"><input type="url" id="padletUrl" value="${esc(d.padlet?.url || '')}" placeholder="https://padlet.com/…"><button class="btn sec peq" id="salvarPadlet">Salvar link</button></div>
        ${pad ? `<table style="margin-top:10px"><thead><tr><th>P</th><th>No Padlet</th><th>Avaliada</th><th>Link bate</th></tr></thead><tbody>${pad.porP.map((l) => `<tr><td><b>${l.p}</b></td><td>${l.presente ? `<span class="tag ok">postada</span> <span class="hint">${l.anexos} anexo(s), ${l.links.length} link(s)</span>` : '<span class="tag ruim">não encontrada</span>'}</td><td>${l.avaliadaNoApp ? '✔' : '✘'}</td><td>${l.linkBateComAvaliacao === null ? '—' : l.linkBateComAvaliacao ? '✔' : '<span class="tag aviso">diferente</span>'}</td></tr>`).join('')}</tbody></table>
          <div class="hint" style="margin-top:6px">Título: ${esc(pad.titulo)} · seções: ${esc(pad.secoes.join(', '))} · ${pad.temSobreMim ? '✔' : '✘'} apresentação pessoal · ${pad.temDesafio ? '✔' : '✘'} desafio${pad.semelhancaDesafioP1 !== null ? ` (semelhança com a P1: ${pad.semelhancaDesafioP1}%)` : ''}. Conferido em ${new Date(d.padlet.em).toLocaleString('pt-BR')}.</div>`
          : `<div class="hint" style="margin-top:8px">Ainda não conferido. Salve o link e peça ao Claude: “confere o Padlet da turma ${esc(chave)}”.</div>`}
        <div id="statusPadlet" class="status"></div></div></div>
      ${f.cruzamentoLinksP6.length ? `<div class="card"><h2>O relato (P6) aponta para os produtos entregues?</h2><table><thead><tr><th>Produto</th><th>Links no relato</th><th>Links na avaliação da P</th><th>Coincidem</th></tr></thead><tbody>${f.cruzamentoLinksP6.map((l) => `<tr><td>${l.p} · ${NOMES_P[l.p]}</td><td>${l.linksNoRelato}</td><td>${l.linksNaP}</td><td>${l.coincidem ? '<span class="tag ok">sim</span>' : '<span class="tag aviso">não</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${x ? `<div class="grade2"><div class="card"><h2>Sugestões para seguir adiante</h2><ul class="lista-ev">${x.sugestoes_continuidade.map((s) => `<li><b>${esc(s.sugestao)}</b><div class="hint">${esc(s.por_que)}</div></li>`).join('')}</ul></div>
      <div class="card"><h2>Pontos de atenção para a banca</h2>${x.atencao_banca.length ? `<ul class="lista-ev">${x.atencao_banca.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}${f.alertas.length ? `<h3>Alertas registrados nas avaliações</h3><ul class="lista-ev">${f.alertas.map((al) => `<li><b>${al.p}</b> ${esc(al.alerta)}</li>`).join('')}</ul>` : ''}</div></div>
      <div class="card"><h2>Parecer ao professor orientador e à banca</h2><div class="texto">${esc(x.parecer_orientador)}</div></div>` : ''}
    </div>`;
    $('#gerar').onclick = async () => {
      const b = $('#gerar'); b.disabled = true; $('#statusGerar').textContent = 'Lendo as seis entregas e cruzando… isso leva cerca de 1 minuto.';
      try { await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(alunoChave)}/dossie`, { method: 'POST', body: JSON.stringify({ forcar: Boolean(x) && !x.desatualizado ? confirm('Os dados não mudaram. Gerar mesmo assim? O texto pode variar um pouco.') : true }) }); telaAluno(chave, alunoChave); }
      catch (e) { $('#statusGerar').textContent = `Não foi possível gerar: ${e.message}`; b.disabled = false; }
    };
    $('#salvarPadlet').onclick = async () => {
      try { const r = await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(alunoChave)}/padlet`, { method: 'POST', body: JSON.stringify({ url: $('#padletUrl').value.trim() }) }); if (r.verificacao) telaAluno(chave, alunoChave); else $('#statusPadlet').textContent = r.aviso || 'Link salvo.'; }
      catch (e) { $('#statusPadlet').textContent = e.message; }
    };
  }

  // ================= relatório da turma =================
  async function telaRelatorio(chave) {
    app.innerHTML = '<div class="card">Montando o relatório da turma…</div>';
    const r = await api(`/api/turmas/${encodeURIComponent(chave)}/relatorio`);
    const t = r.turma, ia = r.relatorio?.conteudo;
    const temas = Object.entries(t.temas).map(([k, v]) => ({ rotulo: r.temas[k], valor: v.pct })).sort((a, b) => a.valor - b.valor);
    const item = (cls) => (i) => `<div class="item-ia ${cls}"><b>${esc(i.titulo)}</b><div>${esc(i.descricao)}</div>${i.evidencia ? `<div class="ev">Evidência: ${esc(i.evidencia)}</div>` : ''}</div>`;
    app.innerHTML = `
      <div class="capa"><small>Relatório da turma · fechamento do portfólio</small><h2>${esc(r.nome)}</h2><div class="meta"><span><b>Estudantes:</b> ${t.alunos}</span><span><b>Completaram P1 a P6:</b> ${t.completos}</span><span><b>Média geral:</b> ${fmt(t.mediaGeral)}</span><span><b>Emissão:</b> ${new Date().toLocaleDateString('pt-BR')}</span></div></div>
      <div class="card no-print"><div class="barra-ferr" style="margin-top:0"><button class="btn ouro" id="gerarRel">${ia ? '↻ Gerar análise novamente' : '✨ Gerar análise da turma com IA'}</button><button class="btn sec" onclick="window.print()">🖨 Imprimir / salvar em PDF</button><a class="btn sec" href="#/turma/${encodeURIComponent(chave)}">← Voltar à turma</a></div>
        <div id="statusRel" class="status">${ia ? `Gerado em ${new Date(r.relatorio.em).toLocaleString('pt-BR')} · ${esc(r.relatorio.modelo)}. A análise usa também as sínteses dos dossiês já gerados.` : 'Os números e gráficos já estão calculados. A análise (tendências, maiores problemas e acertos, relações entre as Ps) é gerada pela IA; ela fica melhor depois de gerar os dossiês.'}</div></div>
      ${ia ? `<div class="card"><h2>Panorama</h2><div class="texto">${esc(ia.panorama)}</div></div>` : ''}
      <div class="grade2"><div class="card"><h2>Entregas por P</h2>${G.funil(t.funil, t.alunos)}<div class="hint">${Object.keys(t.paradas).length ? 'Onde param os que não completaram: ' + Object.entries(t.paradas).map(([p, n]) => `${n} na ${p}`).join(', ') + '.' : 'Ninguém parou no caminho.'}</div></div>
        <div class="card"><h2>Média da turma em cada P</h2>${G.colunasPorP(t.estatPorP)}<div class="hint">Passe o mouse para ver mínimo, máximo e mediana. ${PS.map((p) => t.estatPorP[p].abaixoDe6 ? `${t.estatPorP[p].abaixoDe6} abaixo de 6 na ${p}` : '').filter(Boolean).join(' · ')}</div></div></div>
      ${ia ? `<div class="grade2"><div class="card"><h2>Maiores acertos</h2>${ia.maiores_acertos.map(item('bom')).join('') || '<div class="vazio">—</div>'}</div><div class="card"><h2>Maiores problemas</h2>${ia.maiores_problemas.map(item('mau')).join('') || '<div class="vazio">—</div>'}</div></div>
        <div class="card"><h2>Tendências</h2>${ia.tendencias.map(item('')).join('')}</div>
        <div class="card"><h2>Relações entre as Ps</h2>${ia.relacoes_entre_ps.map(item('')).join('')}</div>` : ''}
      <div class="card"><h2>Mapa de calor: estudantes × Ps</h2><div style="overflow:auto">${G.mapaCalor(r.matriz)}</div></div>
      <div class="grade2"><div class="card"><h2>Desempenho da turma por tema</h2>${G.barras(temas)}</div>
        <div class="card"><h2>Temas que persistem fracos e temas superados</h2><h3>Persistem (nº de estudantes)</h3>${G.barras(Object.entries(t.persistentesTurma).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: k, valor: v, cor: '#B03A2E' })), { max: Math.max(1, t.alunos), sufixo: '' })}<h3>Superados (nº de estudantes)</h3>${G.barras(Object.entries(t.superadosTurma).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: k, valor: v, cor: '#1E8449' })), { max: Math.max(1, t.alunos), sufixo: '' })}</div></div>
      <div class="grade2"><div class="card"><h2>Critérios mais frágeis da turma</h2>${G.barras(t.criteriosFrageis.map((c) => ({ rotulo: `${c.p} · ${c.criterio}`, valor: c.pct })))}</div>
        <div class="card"><h2>Critérios mais fortes da turma</h2>${G.barras(t.criteriosFortes.map((c) => ({ rotulo: `${c.p} · ${c.criterio}`, valor: c.pct })))}</div></div>
      <div class="grade2"><div class="card"><h2>Quem vai bem numa P vai bem em outra?</h2>${t.correlacoes.length ? `<table><thead><tr><th>Ps</th><th>Correlação</th><th>Leitura</th></tr></thead><tbody>${t.correlacoes.map((c) => `<tr><td>${c.entre}</td><td><b>${c.r.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> <span class="hint">(n=${c.n})</span></td><td class="hint">${Math.abs(c.r) >= 0.7 ? (c.r > 0 ? 'forte: as notas andam juntas' : 'forte e inversa') : Math.abs(c.r) >= 0.4 ? (c.r > 0 ? 'moderada' : 'moderada e inversa') : 'fraca'}${c.n < 8 ? ', poucos dados' : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="vazio">São necessários ao menos 4 estudantes com as duas Ps.</div>'}</div>
        <div class="card"><h2>Fio do desafio e uso de IA</h2>${t.comDeriva.length ? `<div class="aviso-box">Desafio muda de foco: ${t.comDeriva.map((d) => `<b>${esc(d.nome)}</b> (${d.ps.join(', ')})`).join('; ')}.</div>` : '<div class="hint">Nenhum estudante com mudança forte de desafio.</div>'}${t.comMudancaPublico.length ? `<div class="aviso-box" style="margin-top:6px">Público muda: ${t.comMudancaPublico.map((d) => `<b>${esc(d.nome)}</b> (${d.ps.join(', ')})`).join('; ')}.</div>` : ''}
          <h3>Declararam uso de IA</h3>${G.barras(t.iaPorP.map((x) => ({ rotulo: x.p, valor: x.de ? Math.round((x.sim / x.de) * 100) : 0, cor: '#2E6E97' })))}</div></div>
      ${t.alertasFrequentes.length ? `<div class="card"><h2>Alertas mais frequentes nas avaliações</h2><table><tbody>${t.alertasFrequentes.map((a) => `<tr><td>${esc(a.alerta)}</td><td style="text-align:right"><b>${a.vezes}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${ia ? `<div class="card"><h2>Perfil dos desafios</h2><div class="texto">${esc(ia.perfil_dos_desafios)}</div></div>
        <div class="grade2"><div class="card"><h2>Estudantes que pedem atenção</h2>${ia.alunos_atencao.length ? `<ul class="lista-ev">${ia.alunos_atencao.map((x) => `<li><b>${esc(x.nome)}</b>: ${esc(x.motivo)}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}</div><div class="card"><h2>Destaques</h2>${ia.destaques.length ? `<ul class="lista-ev">${ia.destaques.map((x) => `<li><b>${esc(x.nome)}</b>: ${esc(x.motivo)}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}</div></div>
        <div class="grade2"><div class="card"><h2>Recomendações para a banca</h2><ul class="lista-ev">${ia.recomendacoes_banca.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div><div class="card"><h2>Recomendações para a próxima oferta</h2><ul class="lista-ev">${ia.recomendacoes_proxima_oferta.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div>`
      : `<div class="card"><h2>Estudantes que pedem atenção (pelos números)</h2>${t.emAtencao.length ? `<ul class="lista-ev">${t.emAtencao.map((x) => `<li><b>${esc(x.nome)}</b>: média ${fmt(x.media)}${x.tendencia !== null && x.tendencia <= -0.5 ? ', notas caindo' : ''}${x.persistentes.length >= 3 ? `, ${x.persistentes.length} temas fracos persistentes` : ''}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}</div>`}`;
    $('#gerarRel').onclick = async () => {
      const b = $('#gerarRel'); b.disabled = true; $('#statusRel').textContent = 'Analisando a turma… cerca de 1 minuto.';
      try { await api(`/api/turmas/${encodeURIComponent(chave)}/relatorio`, { method: 'POST', body: JSON.stringify({ forcar: Boolean(ia) }) }); telaRelatorio(chave); }
      catch (e) { $('#statusRel').textContent = `Não foi possível gerar: ${e.message}`; b.disabled = false; }
    };
  }

  // ================= rotas =================
  async function rota() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const partes = h.split('/');
    window.scrollTo(0, 0);
    try {
      if (partes[0] === 'turma' && partes[2] === 'aluno') await telaAluno(partes[1], partes[3]);
      else if (partes[0] === 'turma' && partes[2] === 'relatorio') await telaRelatorio(partes[1]);
      else if (partes[0] === 'turma' && partes[1]) await telaTurma(partes[1]);
      else await telaInicio();
    } catch (e) { erroNaTela(e); }
  }
  window.addEventListener('hashchange', rota);
  rota();
})();
