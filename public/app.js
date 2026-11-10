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
  // Avaliações por turma em cada P (turmas de mesmo nome aparecem somadas na mesma linha, ex.: "13 + 0").
  function tabelaTurmas(f) {
    const norm = (n) => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bturma\b|\btedpro\b|\b(19|20)\d\d\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    const linhas = new Map();
    for (const p of PS) for (const t of f.opcoes[p] || []) {
      const k = norm(t.nome) || t.id;
      if (!linhas.has(k)) linhas.set(k, { nome: t.nome, ps: {} });
      (linhas.get(k).ps[p] = linhas.get(k).ps[p] || []).push(t.quantidade);
    }
    if (!linhas.size) return '';
    const ord = [...linhas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return `<h3>Avaliações por turma em cada P</h3><div style="overflow:auto"><table><thead><tr><th>Turma</th>${PS.map((p) => `<th style="text-align:center">${p}</th>`).join('')}</tr></thead><tbody>${ord.map((l) => `<tr><td><b>${esc(l.nome)}</b></td>${PS.map((p) => { const v = l.ps[p]; return `<td style="text-align:center">${v ? `<b>${v.join(' + ')}</b>${v.length > 1 ? ' <span class="tag aviso" title="Há mais de uma turma com esse nome nesta P">repetida</span>' : ''}` : '<span class="hint">—</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  async function telaInicio() {
    app.innerHTML = '<div class="card">Buscando os dados das P1 a P6…</div>';
    const f = await api('/api/fontes');
    const fontes = PS.map((p) => { const s = f.status[p] || {}; return `<span class="fonte ${s.ok ? 'ok' : 'erro'}" title="${esc(s.repo)}${s.erro ? ': ' + esc(s.erro) : ''}"><b>${p}</b> ${s.ok ? `${s.turmas} turma(s) · ${s.avaliacoes} avaliação(ões)${s.atualizadoEm ? ` · GitHub ${dataCurta(s.atualizadoEm)}` : ''}` : 'sem acesso'}</span>`; }).join('');
    // todas as turmas de cada P (inclusive com nomes repetidos), com a quantidade de avaliações
    const opcoes = (p) => `<option value="">(não usar)</option>` + (f.opcoes[p] || []).map((t) => `<option value="${esc(t.id)}">${esc(t.nome)} (${t.quantidade})</option>`).join('');
    app.innerHTML = `
      <div class="card"><h2>Abrir o fechamento de uma turma</h2>
        <div class="hint">Digite o nome da turma (por exemplo, <b>Calabresa</b>). O app procura a turma em cada uma das seis Ps; confira e ajuste antes de abrir.</div>
        <div class="barra-ferr"><input type="text" id="pedido" placeholder="Nome da turma" style="max-width:340px"><button class="btn" id="procurar">Procurar nas Ps</button></div>
        <div id="mapaBox" class="oculto"><div class="grade6" style="margin-top:12px">${PS.map((p) => `<div><label for="m_${p}">${p} · ${NOMES_P[p]}</label><select id="m_${p}">${opcoes(p)}</select></div>`).join('')}</div>
        <label for="nomeTurma">Nome do fechamento</label><input type="text" id="nomeTurma" style="max-width:340px">
        <div class="barra-ferr"><button class="btn ouro" id="abrir">Abrir fechamento</button></div></div>
        <div id="statusAbrir" class="status"></div></div>
      ${f.abertas.length ? `<div class="card"><h2>Fechamentos já abertos</h2><table><thead><tr><th>Turma</th><th>Ps ligadas</th><th>Atualizado</th><th></th></tr></thead><tbody>${f.abertas.map((t) => `<tr><td><b>${esc(t.nome)}</b></td><td>${PS.filter((p) => t.mapa?.[p]).join(', ') || '—'}</td><td>${t.atualizadaEm ? new Date(t.atualizadaEm).toLocaleDateString('pt-BR') : ''}</td><td><a class="btn peq" href="#/turma/${encodeURIComponent(t.chave)}">Abrir</a> <button class="btn peq sec" data-excluir="${esc(t.chave)}" data-nome="${esc(t.nome)}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="card"><h2>Dados das Ps <button class="btn sec peq no-print" id="atualizarFontes">↻ Atualizar do GitHub</button></h2><div class="fontes">${fontes}</div>${tabelaTurmas(f)}<div class="hint" style="margin-top:8px">Lidos em ${new Date(f.atualizadoEm).toLocaleString('pt-BR')}.</div></div>`;
    $('#atualizarFontes').onclick = async () => { await api('/api/fontes?atualizar=1'); telaInicio(); };
    app.querySelectorAll('[data-excluir]').forEach((b) => (b.onclick = () => excluirFechamento(b.dataset.excluir, b.dataset.nome)));
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

  const dataCurta = (d) => { try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  async function excluirFechamento(chave, nome) {
    if (!confirm(`Excluir o fechamento "${nome}"?\n\nSomem os dossiês e o relatório gerados, os links de Padlet e os ajustes de nomes. As avaliações das Ps não são afetadas, e você pode abrir o fechamento de novo depois.`)) return;
    await api(`/api/turmas/${encodeURIComponent(chave)}`, { method: 'DELETE' });
    location.hash = '#/'; telaInicio();
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
      <td><b title="Soma das notas ÷ 6">${fmt(a.media)}</b> <span class="hint" title="Média só das Ps entregues">(${fmt(a.mediaEntregues)})</span><br>${seta(a.tendencia)}<div class="hint">${esc(a.perfil || '')}</div></td>
      <td>${a.derivas.length ? `<span class="tag ruim" title="O desafio dessas Ps tem pouca semelhança com o da primeira entrega">muda em ${a.derivas.join(', ')}</span>` : ''}${a.reformulacoes.length ? `<span class="tag aviso" title="Mesmo tema, mas com outro recorte (público, local ou foco)">reformulado em ${a.reformulacoes.join(', ')}</span>` : ''}${!a.derivas.length && !a.reformulacoes.length ? (a.entregues.length > 1 ? '<span class="tag ok">mantido</span>' : '<span class="tag neutra">uma entrega</span>') : ''}</td>
      <td>${a.padlet ? (a.padlet.conferido ? (a.padlet.faltamNoPadlet.length ? `<span class="tag aviso">faltam ${a.padlet.faltamNoPadlet.join(', ')}</span>` : '<span class="tag ok">completo</span>') + (a.padletLido ? '<div class="hint">versões lidas</div>' : '') : '<span class="tag neutra">link salvo</span>') : '<span class="tag neutra">não conferido</span>'}</td>
      <td>${a.dossie ? `<span class="tag ${a.dossie.desatualizado ? 'aviso' : 'ok'}">${a.dossie.desatualizado ? 'dados mudaram' : (a.dossie.etapa === 'final' ? 'final' : 'preliminar')}</span>` : '<span class="tag neutra">não gerado</span>'}${a.correcoes && a.correcoes.taxa !== null ? `<div class="hint">correções: <b>${a.correcoes.taxa}%</b></div>` : ''}</td>
      <td class="no-print"><a class="btn peq" href="#/turma/${encodeURIComponent(chave)}/aluno/${encodeURIComponent(a.chave)}">Abrir dossiê</a></td></tr>`;
    app.innerHTML = `
      <div class="card"><h2>${esc(t.nome)} <span class="hint">· fechamento do portfólio</span></h2>
        <div class="kpis"><div class="kpi"><small>Estudantes</small><strong>${t.alunos.length}</strong><em>com ao menos uma P avaliada</em></div>
        <div class="kpi"><small>Completaram P1 a P6</small><strong>${completos.length}</strong><em>recebem o dossiê de banca</em></div>
        <div class="kpi"><small>Média geral (÷6)</small><strong>${fmt(t.turma.mediaGeral)}</strong><em>média das notas dos estudantes nas 6 Ps · só entregues: ${fmt(t.turma.mediaGeralEntregues)}</em></div>
        <div class="kpi"><small>Notas subindo / caindo</small><strong>${t.turma.melhoraram} / ${t.turma.pioraram}</strong><em>tendência ao longo das Ps</em></div></div>
        <h3>Avaliações consideradas neste fechamento</h3><div class="fontes">${PS.map((p) => { const c = t.contagem[p] || {}; return t.mapa[p] ? `<span class="fonte ok" title="Turma ${esc(c.turma)} na ${p}${c.consideradas !== c.avaliacoes ? ` · ${c.avaliacoes - c.consideradas} avaliação(ões) repetida(s) ou sem nome não contaram` : ''}"><b>${p}</b> ${c.consideradas} avaliação(ões)${c.consideradas !== c.avaliacoes ? ` de ${c.avaliacoes}` : ''} · ${esc(c.turma)}</span>` : `<span class="fonte erro"><b>${p}</b> não ligada</span>`; }).join('')}</div>
        <div class="barra-ferr no-print"><a class="btn ouro" href="#/turma/${encodeURIComponent(chave)}/relatorio">📊 Relatório da turma</a><button class="btn" id="gerarTodos">✨ Gerar dossiês dos que completaram</button><button class="btn sec" id="atualizarDados">↻ Atualizar dados das Ps</button><label class="btn sec" for="listaPadlet" style="margin:0">📎 Importar lista de Padlets (TXT)</label><input type="file" id="listaPadlet" accept=".txt,.csv,text/plain" class="oculto"><a class="btn sec" href="#/">Trocar de turma</a></div>
        <div class="hint" style="margin-top:6px">Lista de Padlets: um estudante por linha, com o nome e o link (ex.: <code>Ana Paula Souza ; https://padlet.com/...</code>). A ordem e o separador não importam.</div>
        <div id="statusLote" class="status"></div><div class="progresso oculto" id="progLote"><span></span></div>
        ${Object.keys(t.sugestoesNovas || {}).length ? `<div class="aviso-box" style="margin-top:10px">A turma <b>${esc(t.nome)}</b> agora existe também na <b>${Object.keys(t.sugestoesNovas).join(', ')}</b>. <button class="btn peq ouro" id="ligarNovas">Ligar ao fechamento</button></div>` : ''}
        <details style="margin-top:10px" ${PS.some((p) => !t.mapa[p]) ? '' : ''}><summary class="hint" style="cursor:pointer"><b>Ps ligadas:</b> ${PS.map((p) => `${p} ${t.mapa[p] ? '✔' : '✘'}`).join(' · ')} · <u>editar</u></summary>
          <div class="grade6" style="margin-top:8px">${PS.map((p) => { const s = t.status[p] || {}; return `<div><label for="mapa_${p}">${p} · ${NOMES_P[p]}</label><select id="mapa_${p}"><option value="">(não usar)</option>${(t.opcoes[p] || []).map((o) => `<option value="${esc(o.id)}" ${t.mapa[p] === o.id ? 'selected' : ''}>${esc(o.nome)} (${o.quantidade})</option>`).join('')}</select><div class="hint">${s.ok ? (s.atualizadoEm ? `Última cópia no GitHub: ${dataCurta(s.atualizadoEm)}` : 'Sem cópia no GitHub ainda') : 'Sem acesso ao repositório'}</div></div>`; }).join('')}</div>
          <div class="barra-ferr"><button class="btn sec peq" id="salvarMapa">Salvar Ps ligadas</button><button class="btn sec peq" id="excluirFech" style="color:#8f2f26;border-color:#8f2f26">🗑 Excluir este fechamento</button></div></details></div>
      ${juncoesDuvidosas.length || t.duplicadas.length ? `<div class="card"><h2>Conferência dos nomes</h2>
        ${juncoesDuvidosas.map((x) => `<div class="aviso-box" style="margin-bottom:6px">Na ${x.p}, "<b>${esc(x.j.nomeNaP)}</b>"${x.j.matriculaNaP ? ` (matrícula ${esc(x.j.matriculaNaP)})` : ' (sem matrícula)'} foi ligado a <b>${esc(x.aluno.nome)}</b> pelo nome parecido. <button class="btn peq sec" data-desfazer="${x.p}|${esc(x.j.avaliacaoId)}">Não é a mesma pessoa</button></div>`).join('')}
        ${t.duplicadas.map((d) => `<div class="hint">Na ${d.p}, ${esc(d.aluno)} tinha duas avaliações; ficou a mais recente.</div>`).join('')}</div>` : ''}
      <div class="card"><h2>Completaram as seis Ps (${completos.length})</h2>${completos.length ? `<div style="overflow:auto"><table><thead><tr><th>Estudante</th><th>Notas P1 a P6</th><th title="Soma ÷ 6 (entre parênteses, só as entregues)">Média ÷6 (entregues)</th><th>Fio do desafio</th><th>Padlet</th><th>Dossiê</th><th></th></tr></thead><tbody>${completos.map(linha).join('')}</tbody></table></div>` : '<div class="vazio">Ninguém completou as seis Ps nesta turma ainda.</div>'}</div>
      ${incompletos.length ? `<div class="card"><h2>Ainda não completaram (${incompletos.length})</h2><div class="hint">Também é possível abrir o dossiê, com o que já foi entregue. Se alguém aparece aqui só porque o nome ou a matrícula não bateram, junte com o estudante certo.</div><div style="overflow:auto"><table><thead><tr><th>Estudante</th><th>Notas P1 a P6</th><th title="Soma ÷ 6 (entre parênteses, só as entregues)">Média ÷6 (entregues)</th><th>Fio do desafio</th><th>Padlet</th><th>Dossiê</th><th></th></tr></thead><tbody>${incompletos.map((a) => linha(a).replace('</td></tr>', `<div style="margin-top:6px"><select data-juntar="${esc(a.chave)}" class="no-print" style="font-size:.74rem;padding:4px"><option value="">Juntar com…</option>${t.alunos.filter((b) => b.chave !== a.chave).map((b) => `<option value="${esc(b.chave)}">${esc(b.nome)}</option>`).join('')}</select></div></td></tr>`)).join('')}</tbody></table></div></div>` : ''}`;
    $('#atualizarDados').onclick = () => telaTurma(chave, true);
    const salvarMapa = async (mapa) => { await api(`/api/turmas/${encodeURIComponent(chave)}/mapa`, { method: 'PUT', body: JSON.stringify({ mapa }) }); telaTurma(chave, true); };
    $('#salvarMapa').onclick = () => salvarMapa(Object.fromEntries(PS.map((p) => [p, $(`#mapa_${p}`).value])));
    if ($('#ligarNovas')) $('#ligarNovas').onclick = () => salvarMapa({ ...t.mapa, ...t.sugestoesNovas });
    $('#excluirFech').onclick = () => excluirFechamento(chave, t.nome);
    $('#listaPadlet').onchange = async (ev) => {
      const arq = ev.target.files[0]; if (!arq) return;
      const itens = (await arq.text()).split(/\r?\n/).map((l) => {
        const url = (l.match(/https?:\/\/[^\s;,]+/) || [''])[0];
        const nome = l.replace(url, '').replace(/[;,\t|]+/g, ' ').replace(/\s[-–]\s/g, ' ').replace(/\s+/g, ' ').trim();
        return { nome, url };
      }).filter((x) => x.url && x.nome);
      if (!itens.length) { $('#statusLote').textContent = 'Não encontrei linhas com nome e link do Padlet no arquivo.'; return; }
      try {
        const r = await api(`/api/turmas/${encodeURIComponent(chave)}/padlet-lote`, { method: 'POST', body: JSON.stringify({ itens }) });
        $('#statusLote').textContent = `${r.feitos.length} link(s) de Padlet salvos.${r.naoEncontrados.length ? ` Não encontrei na turma: ${r.naoEncontrados.join(', ')}.` : ''} Agora peça ao Claude: “confere o Padlet da turma ${t.nome}”.`;
        setTimeout(() => telaTurma(chave), 2500);
      } catch (e) { $('#statusLote').textContent = e.message; }
      ev.target.value = '';
    };
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
  const ANGULOS = { fio_do_desafio: 'Fio do desafio', escrito_x_entregue: 'Escrito × entregue', evidencias: 'Evidências', escolhas: 'Escolhas pedagógicas e tecnológicas', aprendizagem: 'Aprendizagem', continuidade: 'Continuidade' };
  const ROT_CORR = { corrigido: ['✔ corrigido', 'ok'], parcial: ['◐ parcial', 'aviso'], nao_corrigido: ['✘ não corrigido', 'ruim'], nova_versao: ['↻ nova versão (conferir)', 'neutra'], nao_verificavel: ['não verificável', 'neutra'] };
  // Correções pedidas pelo orientador × versão publicada no Padlet.
  function blocoCorrecoes(d) {
    const c = d.correcoes;
    if (!c) return `<div class="card"><h2>Correções pedidas × versão no Padlet</h2><div class="hint">Etapa preliminar. Quando os Padlets forem lidos, este quadro mostra, P por P, se cada indicação do orientador foi atendida na versão publicada, e o dossiê passa a usar essas versões como produtos finais.</div></div>`;
    const chips = Object.entries(c.conta).map(([k, n]) => `<span class="tag ${ROT_CORR[k][1]}">${ROT_CORR[k][0]}: ${n}</span>`).join(' ');
    return `<div class="card"><h2>Correções pedidas × versão no Padlet ${c.taxa !== null ? `<span class="tag ${c.taxa >= 80 ? 'ok' : c.taxa >= 50 ? 'aviso' : 'ruim'}">${c.taxa}% atendidas</span>` : ''}</h2>
      <div>${chips}</div>${c.sintese ? `<div class="texto" style="margin-top:8px">${esc(c.sintese)}</div>` : ''}
      ${PS.filter((p) => c.porP[p]).map((p) => { const x = c.porP[p]; const fontes = d.padlet?.versoesResumo?.[p]?.fontes || [];
        const sm = c.sinaisMidia?.[p];
        const dt = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '?';
        const midia = sm ? `<div class="aviso-box" style="margin:6px 0"><b>${p === 'P2' ? 'Vídeo' : 'Podcast'}:</b> ${esc(sm.conclusao)}.<div class="hint">Avaliado: ${sm.linkAvaliado ? `<a href="${esc(sm.linkAvaliado)}" target="_blank" rel="noopener">${esc(sm.linkAvaliado)}</a>` : 'sem link'}${sm.duracaoAvaliada ? `, duração ${esc(sm.duracaoAvaliada)}` : ''}, avaliação de ${dt(sm.dataAvaliacao)}.${sm.noPadlet.length ? ` No Padlet: ${sm.noPadlet.map((m) => m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.link)}</a> (${dt(m.publicadoEm)})` : `${esc(m.arquivo)}${m.bytes ? ` · ${(m.bytes / 1048576).toFixed(1)} MB` : ''} (${dt(m.publicadoEm)})`).join('; ')}.` : ''}</div></div>` : '';
        return `<h3>${p} · ${NOMES_P[p]} ${x.taxa !== null ? `<span class="hint">(${x.taxa}% atendidas)</span>` : ''}</h3>${midia}${fontes.length ? `<div class="hint">No Padlet: ${fontes.map((f) => `${esc(f.nome)} (${f.lido ? 'lido' : esc(f.tipo) + ', não lido'})`).join('; ')}</div>` : ''}
        ${x.itens.length ? `<table><thead><tr><th>Indicação do orientador</th><th>Situação</th><th>Evidência na versão do Padlet</th></tr></thead><tbody>${x.itens.map((i) => `<tr><td>${esc(i.indicacao)}${i.origem ? `<div class="hint">${esc(i.origem)}</div>` : ''}</td><td><span class="tag ${ROT_CORR[i.status][1]}">${ROT_CORR[i.status][0]}</span></td><td>${esc(i.evidencia || '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="vazio">Nenhuma indicação de melhoria nesta P.</div>'}
        ${x.melhorias_extras.length ? `<div class="hint" style="margin-top:4px">Melhorias feitas sem terem sido pedidas: ${esc(x.melhorias_extras.join('; '))}</div>` : ''}`; }).join('')}</div>`;
  }
  const ROT_RESP = { sim: ['✔ sim', 'ok'], parcial: ['◐ parcial', 'aviso'], nao: ['✘ não', 'ruim'], sem_dados: ['sem dados', 'neutra'] };
  async function telaAluno(chave, alunoChave) {
    app.innerHTML = '<div class="card">Montando o dossiê…</div>';
    const d = await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(alunoChave)}`);
    const f = d.fatos, x = d.dossie, a = d.aluno;
    const temasRadar = {}; for (const [k, v] of Object.entries(f.temas)) temasRadar[k] = { pct: v.pct, turma: v.turma };
    const pad = d.padlet?.verificacao;
    const gerar = `<div class="barra-ferr no-print"><button class="btn ouro" id="gerar">${x ? '↻ Gerar novamente' : '✨ Gerar dossiê com IA'}</button><button class="btn sec" onclick="window.print()">🖨 Imprimir / salvar em PDF</button><a class="btn sec" href="#/turma/${encodeURIComponent(chave)}">← Voltar à turma</a></div><div id="statusGerar" class="status">${x ? `Gerado em ${new Date(x.geradoEm).toLocaleString('pt-BR')} · ${esc(x.modelo)}${x.desatualizado ? ' · <b>os dados mudaram desde então: gere novamente</b>' : ' · mesmos dados, mesmo dossiê'}` : (d.padlet?.versoesResumo ? 'As versões do Padlet já foram lidas: o dossiê será gerado na versão final, conferindo as correções.' : 'Os fatos e gráficos abaixo já estão calculados. Sem os Padlets lidos, o dossiê sai na versão preliminar.')}</div>`;
    app.innerHTML = `<div class="dossie">
      <div class="capa"><small>Dossiê de banca · uso exclusivo dos professores${x ? ` · ${x.etapa === 'final' ? 'versão final, com os Padlets' : 'versão preliminar, antes dos Padlets'}` : ''}</small><h2>${esc(a.nome)}</h2>
        <div>${esc(f.fioDesafio[0]?.desafio || 'Desafio não registrado')}</div>
        <div class="meta"><span><b>Matrícula:</b> ${esc(a.matricula || '—')}</span><span><b>Orientação informada:</b> ${esc(a.orientadores.join(' / ') || '—')}</span><span><b>Entregas:</b> ${a.entregues.join(', ')}${a.faltam.length ? ` (falta ${a.faltam.join(', ')})` : ''}</span><span><b>Média (÷6):</b> ${fmt(f.mediaAluno)} · entregues ${fmt(f.mediaEntregues)} (turma ${fmt(f.mediaTurma)})</span><span><b>Perfil:</b> ${esc(f.perfil.rotulo)}</span></div></div>
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
      ${blocoCorrecoes(d)}
      <div class="card"><h2>Perguntas para a banca</h2>${x.perguntas_banca.map((q, i) => `<div class="perg">${q.angulo ? `<span class="tag neutra">${esc(ANGULOS[q.angulo] || q.angulo)}</span>` : ''}<div class="q">${i + 1}. ${esc(q.pergunta)}</div><div class="det"><b>Por que perguntar:</b> ${esc(q.por_que)}${psTag(q.ps)}</div><div class="det"><b>O que uma boa resposta mostraria:</b> ${esc(q.o_que_observar)}</div></div>`).join('')}</div>
      <div class="grade2"><div class="card"><h2>Pontos fortes</h2><ul class="lista-ev">${x.pontos_fortes.map((p) => `<li>${esc(p.texto)}${psTag(p.ps)}</li>`).join('')}</ul></div>
      <div class="card"><h2>Fragilidades</h2><ul class="lista-ev">${x.fragilidades.map((p) => `<li>${esc(p.texto)}${psTag(p.ps)}</li>`).join('')}</ul></div></div>
      ${x.contradicoes.length ? `<div class="card"><h2>Contradições e lacunas entre as Ps</h2><ul class="lista-ev">${x.contradicoes.map((p) => `<li>${esc(p.descricao)}${psTag(p.ps)}</li>`).join('')}</ul></div>` : ''}` : ''}
      <div class="card"><h2>Aprendizagem ao longo do curso</h2>${x?.evolucao ? `<div class="texto" style="margin-bottom:10px">${esc(x.evolucao)}</div>` : ''}
        <div class="grade3"><div><h3>Superou</h3>${f.superados.length ? f.superados.map((s) => `<div><span class="tag ok">${esc(s.tema)}</span><div class="hint">${esc(s.de)} → ${esc(s.para)}</div></div>`).join('') : '<div class="vazio">Nenhum tema fraco no início que tenha ficado forte depois.</div>'}</div>
        <div><h3>Persistiu</h3>${f.persistentes.length ? f.persistentes.map((s) => `<div><span class="tag ruim">${esc(s.tema)}</span><div class="hint">${esc(s.ps.join(', '))}</div></div>`).join('') : '<div class="vazio">Nenhum tema abaixo de 75% em mais de uma P.</div>'}</div>
        <div><h3>Caiu</h3>${f.quedas.length ? f.quedas.map((s) => `<div><span class="tag aviso">${esc(s.tema)}</span><div class="hint">${esc(s.de)} → ${esc(s.para)}</div></div>`).join('') : '<div class="vazio">Nenhum tema forte no início que tenha caído depois.</div>'}</div></div>
        <details class="det-crit"${f.abaixo.length <= 8 ? ' open' : ''}><summary><b>Critérios abaixo do máximo, com a observação do avaliador (${f.abaixo.length})</b></summary>${f.abaixo.length ? `<table><thead><tr><th>P</th><th>Critério</th><th>%</th><th>Observação do avaliador</th></tr></thead><tbody>${f.abaixo.map((c) => `<tr><td>${c.p}</td><td>${esc(c.criterio)}</td><td>${c.pct}%</td><td>${c.observacao ? esc(c.observacao) : `<span class="hint">Sem observação neste critério. ${f.feedbacks.some((x) => x.p === c.p) ? `Os comentários da ${c.p} estão no feedback geral, abaixo.` : ''}</span>`}</td></tr>`).join('')}</tbody></table>` : '<div class="vazio">Todos os critérios avaliados no máximo.</div>'}</details>
        ${f.feedbacks.length ? `<details class="det-crit"><summary><b>Feedbacks enviados em cada P (${f.feedbacks.length})</b></summary>${f.feedbacks.map((x) => `<div class="item-ia"><b>${x.p} · ${NOMES_P[x.p]}</b><div class="texto">${esc(x.feedback)}</div>${x.coerencia ? `<div class="ev" style="margin-top:6px"><b>Feedback de coerência:</b> <span class="texto">${esc(x.coerencia)}</span></div>` : ''}</div>`).join('')}</details>` : ''}</div>
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
      const b = $('#gerar'); b.disabled = true; $('#statusGerar').textContent = d.padlet?.versoesResumo ? 'Conferindo as correções no Padlet e cruzando as entregas… isso leva de 2 a 3 minutos.' : 'Lendo as entregas e cruzando… isso leva cerca de 1 minuto.';
      try { await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(alunoChave)}/dossie`, { method: 'POST', body: JSON.stringify({ forcar: Boolean(x) && !x.desatualizado ? confirm('Os dados não mudaram. Gerar mesmo assim? O texto pode variar um pouco.') : true }) }); telaAluno(chave, alunoChave); }
      catch (e) { $('#statusGerar').textContent = `Não foi possível gerar: ${e.message}`; b.disabled = false; }
    };
    $('#salvarPadlet').onclick = async () => {
      try { const r = await api(`/api/turmas/${encodeURIComponent(chave)}/alunos/${encodeURIComponent(alunoChave)}/padlet`, { method: 'POST', body: JSON.stringify({ url: $('#padletUrl').value.trim() }) }); if (r.verificacao) telaAluno(chave, alunoChave); else $('#statusPadlet').textContent = r.aviso || 'Link salvo.'; }
      catch (e) { $('#statusPadlet').textContent = e.message; }
    };
  }

  const comoLer = (txt) => `<div class="como-ler"><b>Como ler:</b> ${txt}</div>`;
  // ================= relatório da turma =================
  async function telaRelatorio(chave) {
    app.innerHTML = '<div class="card">Montando o relatório da turma…</div>';
    const r = await api(`/api/turmas/${encodeURIComponent(chave)}/relatorio`);
    const t = r.turma, ia = r.relatorio?.conteudo;
    const temas = Object.entries(t.temas).map(([k, v]) => ({ rotulo: r.temas[k], valor: v.pct })).sort((a, b) => a.valor - b.valor);
    const item = (cls) => (i) => `<div class="item-ia ${cls}"><b>${esc(i.titulo)}</b><div>${esc(i.descricao)}</div>${i.evidencia ? `<div class="ev">Evidência: ${esc(i.evidencia)}</div>` : ''}</div>`;
    app.innerHTML = `
      <div class="capa"><small>Relatório da turma · fechamento do portfólio</small><h2>${esc(r.nome)}</h2><div class="meta"><span><b>Estudantes:</b> ${t.alunos}</span><span><b>Completaram P1 a P6:</b> ${t.completos}</span><span><b>Média geral (÷6):</b> ${fmt(t.mediaGeral)}</span><span><b>Média das Ps entregues:</b> ${fmt(t.mediaGeralEntregues)}</span><span><b>Emissão:</b> ${new Date().toLocaleDateString('pt-BR')}</span></div></div>
      <div class="card no-print"><div class="barra-ferr" style="margin-top:0"><button class="btn ouro" id="gerarRel">${ia ? '↻ Gerar análise novamente' : '✨ Gerar análise da turma com IA'}</button><button class="btn sec" onclick="window.print()">🖨 Imprimir / salvar em PDF</button><a class="btn sec" href="#/turma/${encodeURIComponent(chave)}">← Voltar à turma</a></div>
        <div id="statusRel" class="status">${ia ? `Gerado em ${new Date(r.relatorio.em).toLocaleString('pt-BR')} · ${esc(r.relatorio.modelo)}. A análise usa também as sínteses dos dossiês já gerados.` : 'Os números e gráficos já estão calculados. A análise (tendências, maiores problemas e acertos, relações entre as Ps) é gerada pela IA; ela fica melhor depois de gerar os dossiês.'}</div></div>
      ${ia ? `<div class="card"><h2>Panorama</h2><div class="texto">${esc(ia.panorama)}</div></div>` : ''}
      ${ia?.leitura_pedagogica ? `<div class="card"><h2>Leitura pedagógica</h2><div class="texto">${esc(ia.leitura_pedagogica)}</div></div>` : ''}
      ${ia?.acoes_orientacao?.length ? `<div class="card"><h2>O que os orientadores podem fazer antes da banca</h2><table><thead><tr><th>Ação</th><th>Para quem</th><th>Por quê</th></tr></thead><tbody>${ia.acoes_orientacao.map((x) => `<tr><td><b>${esc(x.acao)}</b></td><td>${esc(x.para_quem)}</td><td>${esc(x.por_que)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="grade2"><div class="card"><h2>Entregas por P</h2>${comoLer('quantos estudantes desta turma têm cada P avaliada. Uma queda de uma coluna para a seguinte mostra onde a turma começa a deixar de entregar.')}${G.funil(t.funil, t.alunos)}<div class="hint">${Object.keys(t.paradas).length ? 'Onde param os que não completaram: ' + Object.entries(t.paradas).map(([p, n]) => `${n} na ${p}`).join(', ') + '.' : 'Ninguém parou no caminho.'}</div></div>
        <div class="card"><h2>Média da turma em cada P</h2>${comoLer('soma das notas de quem entregou aquela P dividida pelo número de quem entregou (quem não entregou não entra nesta conta). Compare as colunas para ver em que formato a turma teve mais dificuldade.')}${G.colunasPorP(t.estatPorP)}<div class="hint">Passe o mouse para ver mínimo, máximo e mediana. ${PS.map((p) => t.estatPorP[p].abaixoDe6 ? `${t.estatPorP[p].abaixoDe6} abaixo de 6 na ${p}` : '').filter(Boolean).join(' · ')}</div></div></div>
      ${Object.values(r.correcoesPorP).some((x) => x.alunos) ? `<div class="card"><h2>Correções pedidas e atendidas nas versões do Padlet</h2>${G.barras(PS.filter((p) => r.correcoesPorP[p].taxa !== null).map((p) => ({ rotulo: `${p} · ${NOMES_P[p]} (${r.correcoesPorP[p].alunos} estudante(s))`, valor: r.correcoesPorP[p].taxa })))}<div class="hint">Percentual das indicações do orientador atendidas (parcial conta metade), entre as que puderam ser verificadas no texto publicado. ${PS.map((p) => r.correcoesPorP[p].nao_corrigido ? `${p}: ${r.correcoesPorP[p].nao_corrigido} não corrigida(s)` : '').filter(Boolean).join(' · ')}</div></div>` : ''}
      ${ia ? `<div class="grade2"><div class="card"><h2>Maiores acertos</h2>${ia.maiores_acertos.map(item('bom')).join('') || '<div class="vazio">—</div>'}</div><div class="card"><h2>Maiores problemas</h2>${ia.maiores_problemas.map(item('mau')).join('') || '<div class="vazio">—</div>'}</div></div>
        <div class="card"><h2>Tendências</h2>${ia.tendencias.map(item('')).join('')}</div>
        <div class="card"><h2>Relações entre as Ps</h2>${ia.relacoes_entre_ps.map(item('')).join('')}</div>` : ''}
      <div class="card"><h2>Perfis de trajetória</h2>${comoLer('cada estudante recebe um perfil pela mesma regra, olhando as Ps entregues: <b>desempenho baixo</b> (média das entregues abaixo de 6), <b>em ascensão</b> ou <b>em queda</b> (notas subindo ou caindo ao longo das Ps), <b>irregular</b> (grande oscilação entre as Ps), <b>consistente e alto</b> (média de 8,5 ou mais, sem oscilar) e <b>estável</b>. Ajuda a decidir quem precisa de acompanhamento antes da banca e que tipo de conversa ter com cada grupo.')}
        ${ia?.leitura_perfis ? `<div class="texto" style="margin-bottom:10px">${esc(ia.leitura_perfis)}</div>` : ''}
        <div class="grade3">${Object.values(t.perfis).sort((a, b) => b.alunos.length - a.alunos.length).map((p) => `<div class="item-ia ${p.chave === 'baixo' || p.chave === 'queda' ? 'mau' : p.chave === 'ascensao' || p.chave === 'consistente_alto' ? 'bom' : ''}"><b>${esc(p.rotulo)} · ${p.alunos.length}</b><div class="ev">${esc(p.descricao)}</div><div style="font-size:.8rem;margin-top:4px">${p.alunos.map(esc).join(', ')}</div></div>`).join('')}</div></div>
      <div class="card"><h2>Mapa de calor: estudantes × Ps</h2>${comoLer('cada linha é um estudante e cada coluna uma P; a cor vai do vermelho (abaixo de 6) ao verde-escuro (9 a 10). <b>Média (÷6)</b> é a soma das notas dividida pelas 6 Ps, com zero na P não entregue: é a média oficial do portfólio. <b>Média das entregues</b> mostra o desempenho só no que foi entregue. Linhas com colunas cinza indicam entregas pendentes; linhas com cores que mudam muito indicam trajetória irregular.')}<div style="overflow:auto">${G.mapaCalor(r.matriz)}</div></div>
      <div class="grade2"><div class="card"><h2>Desempenho da turma por tema</h2>${comoLer('cada critério das seis rubricas foi agrupado num tema (por exemplo, "Desafio e público-alvo" junta a pergunta-desafio da P1, o desafio e o público no vídeo da P2, a adequação do podcast da P4 e a demanda do agente da P5). A barra é o percentual de pontos que a turma obteve sobre o máximo possível naquele tema, somando todas as Ps. Assim se enxerga a competência por trás das tarefas: um tema baixo indica uma dificuldade que atravessa formatos diferentes, e não um problema de uma P só. Verde: 85% ou mais; amarelo: 70% a 84%; vermelho: abaixo de 70%.')}${G.barras(temas)}</div>
        <div class="card"><h2>Temas que persistem fracos e temas superados</h2>${comoLer('olha a trajetória de cada estudante. <b>Persiste</b>: o tema ficou abaixo de 75% em duas ou mais Ps do mesmo estudante, ou seja, a dificuldade se repetiu mesmo com os feedbacks. <b>Superado</b>: estava abaixo de 75% em P1 a P3 e passou de 85% em todas de P4 a P6, um sinal de aprendizagem. O número é de estudantes. Temas que persistem em muitos estudantes são prioridade de orientação; temas superados mostram onde os feedbacks funcionaram.')}<h3>Persistem (nº de estudantes)</h3>${G.barras(Object.entries(t.persistentesTurma).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: k, valor: v, cor: '#B03A2E' })), { max: Math.max(1, t.alunos), sufixo: '' })}<h3>Superados (nº de estudantes)</h3>${G.barras(Object.entries(t.superadosTurma).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: k, valor: v, cor: '#1E8449' })), { max: Math.max(1, t.alunos), sufixo: '' })}</div></div>
      <div class="grade2"><div class="card"><h2>Critérios mais frágeis da turma</h2>${comoLer('os 8 critérios das rubricas com menor percentual médio na turma (pontos obtidos sobre o máximo, considerando quem foi avaliado). É o nível mais concreto: diz exatamente o que revisar com os estudantes ou reforçar no enunciado da atividade. Se vários critérios frágeis são do mesmo tema, a dificuldade é de competência; se são de forma (tempo, modelo), é de orientação da entrega.')}${G.barras(t.criteriosFrageis.map((c) => ({ rotulo: `${c.p} · ${c.criterio}`, valor: c.pct })))}</div>
        <div class="card"><h2>Critérios mais fortes da turma</h2>${comoLer('os 8 critérios com maior percentual médio. Mostram o que a turma já domina e o que pode servir de ponto de partida na banca, por exemplo pedindo que o estudante explique como fez aquilo que fez bem.')}${G.barras(t.criteriosFortes.map((c) => ({ rotulo: `${c.p} · ${c.criterio}`, valor: c.pct })))}</div></div>
      <div class="grade2"><div class="card"><h2>Quem vai bem numa P vai bem em outra?</h2>${comoLer('correlação entre as notas de duas Ps, calculada só com quem tem as duas. Vai de -1 a 1: perto de 1, quem vai bem numa tende a ir bem na outra (competências parecidas); perto de 0, não há relação (são habilidades diferentes, como escrever e produzir áudio); negativa, quem vai bem numa tende a ir pior na outra. Com menos de 8 estudantes é só um indício. Útil para planejar: uma correlação alta entre P1 e as demais indica que um bom desafio inicial sustenta o percurso.')}${t.correlacoes.length ? `<table><thead><tr><th>Ps</th><th>Correlação</th><th>Leitura</th></tr></thead><tbody>${t.correlacoes.map((c) => `<tr><td>${c.entre}</td><td><b>${c.r.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> <span class="hint">(n=${c.n})</span></td><td class="hint">${Math.abs(c.r) >= 0.7 ? (c.r > 0 ? 'forte: as notas andam juntas' : 'forte e inversa') : Math.abs(c.r) >= 0.4 ? (c.r > 0 ? 'moderada' : 'moderada e inversa') : 'fraca'}${c.n < 8 ? ', poucos dados' : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="vazio">São necessários ao menos 4 estudantes com as duas Ps.</div>'}</div>
        <div class="card"><h2>Fio do desafio e uso de IA</h2>${comoLer('o portfólio deve girar em torno do mesmo desafio e público. O app compara o texto do desafio e do público de cada P com o da primeira entrega: abaixo de 20% de semelhança sugere que o desafio mudou; entre 20% e 39%, que foi reformulado. Confirme no dossiê se foi uma mudança consciente ou perda de foco. As barras mostram, por P, o percentual de estudantes que declarou ter usado IA; usar ou não usar IA não altera a nota, o que conta é a transparência.')}${t.comDeriva.length ? `<div class="aviso-box">Desafio muda de foco: ${t.comDeriva.map((d) => `<b>${esc(d.nome)}</b> (${d.ps.join(', ')})`).join('; ')}.</div>` : '<div class="hint">Nenhum estudante com mudança forte de desafio.</div>'}${t.comMudancaPublico.length ? `<div class="aviso-box" style="margin-top:6px">Público muda: ${t.comMudancaPublico.map((d) => `<b>${esc(d.nome)}</b> (${d.ps.join(', ')})`).join('; ')}.</div>` : ''}
          <h3>Declararam uso de IA</h3>${G.barras(t.iaPorP.map((x) => ({ rotulo: x.p, valor: x.de ? Math.round((x.sim / x.de) * 100) : 0, cor: '#2E6E97' })))}</div></div>
      ${t.alertasFrequentes.length ? `<div class="card"><h2>Alertas mais frequentes nas avaliações</h2><table><tbody>${t.alertasFrequentes.map((a) => `<tr><td>${esc(a.alerta)}</td><td style="text-align:right"><b>${a.vezes}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${ia ? `<div class="card"><h2>Perfil dos desafios</h2><div class="texto">${esc(ia.perfil_dos_desafios)}</div></div>
        <div class="grade2"><div class="card"><h2>Estudantes que pedem atenção</h2>${ia.alunos_atencao.length ? `<ul class="lista-ev">${ia.alunos_atencao.map((x) => `<li><b>${esc(x.nome)}</b>: ${esc(x.motivo)}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}</div><div class="card"><h2>Destaques</h2>${ia.destaques.length ? `<ul class="lista-ev">${ia.destaques.map((x) => `<li><b>${esc(x.nome)}</b>: ${esc(x.motivo)}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}</div></div>
        <div class="grade2"><div class="card"><h2>Recomendações para a banca</h2><ul class="lista-ev">${ia.recomendacoes_banca.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div><div class="card"><h2>Recomendações para a próxima oferta</h2><ul class="lista-ev">${ia.recomendacoes_proxima_oferta.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div>`
      : `<div class="card"><h2>Estudantes que pedem atenção (pelos números)</h2>${t.emAtencao.length ? `<ul class="lista-ev">${t.emAtencao.map((x) => `<li><b>${esc(x.nome)}</b>: média das entregues ${fmt(x.mediaEntregues)}${x.faltam?.length ? `, falta ${x.faltam.join(', ')}` : ''}${x.tendencia !== null && x.tendencia <= -0.5 ? ', notas caindo' : ''}${x.persistentes.length >= 3 ? `, ${x.persistentes.length} temas fracos persistentes` : ''}</li>`).join('')}</ul>` : '<div class="vazio">Nenhum.</div>'}</div>`}`;
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
