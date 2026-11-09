// Conferência do portfólio publicado no Padlet de cada aluno.
// Aceita o conteúdo em dois formatos: o da API pública do Padlet (api.padlet.dev, exige assinatura)
// e o formato simples {titulo, secoes:[{id,titulo}], posts:[{secao, titulo, texto, anexo, publicadoEm}]},
// usado quando a leitura é feita fora do app e importada.
const { ORDEM_P } = require('./fontes');
const { sobreposicao, urls } = require('./fatos');

const API_KEY = process.env.PADLET_API_KEY || '';
const semHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
const ROMANOS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

// Identifica a qual P um título de seção ou de post se refere.
function pDoTitulo(t) {
  const s = String(t || '').toLowerCase();
  let m = s.match(/\bp\s*0?([1-6])\b/) || s.match(/portf[oó]lio\s*0?([1-6])\b/) || s.match(/(?:atividade|entrega|etapa)\s*0?([1-6])\b/);
  if (m) return `P${m[1]}`;
  m = s.match(/portf[oó]lio\s+(vi|iv|v|iii|ii|i)\b/); if (m) return `P${ROMANOS[m[1]]}`;
  if (/relato/.test(s)) return 'P6';
  if (/podcast/.test(s)) return 'P4';
  if (/\bagente\b|\bgem\b/.test(s)) return 'P5';
  if (/proposta formativa|plano de (ensino|aula|forma)/.test(s)) return 'P3';
  if (/v[íi]deo|roteiro/.test(s)) return 'P2';
  if (/descobrindo|defini[çc][ãa]o do desafio/.test(s)) return 'P1';
  return '';
}

// Converte qualquer formato aceito para {titulo, descricao, secoes, posts}.
function padronizar(bruto) {
  if (!bruto) return null;
  if (bruto.padlet && bruto.padlet.padlet_content) bruto = bruto.padlet.padlet_content; // leitura feita pelo conector do Padlet
  if (bruto.padlet_title !== undefined) {
    return {
      titulo: bruto.padlet_title || '', descricao: bruto.padlet_description || '',
      secoes: (bruto.sections || []).map((s) => ({ id: String(s.section_id), titulo: s.section_title || '' })),
      posts: (bruto.posts || []).map((p) => ({ secao: String(p.section_id || ''), titulo: p.subject || '', texto: semHtml(p.body), anexo: p.attachment || '', publicadoEm: p.published_at || '' }))
    };
  }
  if (bruto.data && bruto.data.attributes) { // API pública (JSON:API)
    const inc = bruto.included || [];
    const secoes = inc.filter((x) => x.type === 'section').map((s) => ({ id: String(s.id), titulo: s.attributes?.title || '' }));
    const posts = inc.filter((x) => x.type === 'post').map((p) => {
      const a = p.attributes || {}, c = a.content || {};
      return { secao: String(p.relationships?.section?.data?.id || ''), titulo: c.subject || '', texto: semHtml(c.body), anexo: c.attachment?.url || '', publicadoEm: a.createdAt || a.created_at || '' };
    });
    return { titulo: bruto.data.attributes.title || '', descricao: bruto.data.attributes.description || '', secoes, posts };
  }
  return { titulo: bruto.titulo || '', descricao: bruto.descricao || '', secoes: bruto.secoes || [], posts: bruto.posts || [] };
}

// Lê o Padlet pela API pública (só com PADLET_API_KEY).
async function lerPelaApi(url) {
  if (!API_KEY) throw new Error('PADLET_API_KEY não configurada: importe a leitura do Padlet ou peça ao Claude para conferir.');
  const chave = String(url).split('?')[0].replace(/\/+$/, '').split('-').pop();
  const r = await fetch(`https://api.padlet.dev/v1/boards/${encodeURIComponent(chave)}?include=posts,sections`, { headers: { 'X-Api-Key': API_KEY, Accept: 'application/vnd.api+json' } });
  if (!r.ok) throw new Error(`A API do Padlet respondeu ${r.status}.`);
  return r.json();
}

// Compara o Padlet com as entregas avaliadas.
function verificar(bruto, aluno, fatos) {
  const pad = padronizar(bruto);
  if (!pad) return null;
  const secaoP = Object.fromEntries(pad.secoes.map((s) => [s.id, pDoTitulo(s.titulo)]));
  const porP = {};
  for (const id of ORDEM_P) porP[id] = { posts: 0, anexos: 0, links: [], titulos: [] };
  const semP = [];
  for (const post of pad.posts) {
    const id = pDoTitulo(post.titulo) || secaoP[post.secao] || pDoTitulo(post.anexo.split('/').pop());
    const vazio = !post.titulo && !post.texto && !post.anexo;
    const secaoTitulo = (pad.secoes.find((s) => s.id === post.secao) || {}).titulo || '';
    if (!id && /sobre|quem sou|apresenta|desafio/i.test(secaoTitulo + ' ' + post.titulo)) continue;
    if (!id) { if (!vazio) semP.push(post.titulo || post.anexo.split('/').pop() || post.texto.slice(0, 60)); continue; }
    const x = porP[id]; x.posts++; if (post.anexo) x.anexos++; x.links.push(...urls(post.texto)); if (post.titulo) x.titulos.push(post.titulo);
  }
  const chave = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/+$/, '').toLowerCase(); } catch { return u; } };
  const linhas = ORDEM_P.map((id) => {
    const x = porP[id];
    const linksApp = (fatos.linksPorP[id] || []).map(chave);
    const presente = x.posts > 0 && (x.anexos > 0 || x.links.length > 0);
    return { p: id, presente, posts: x.posts, anexos: x.anexos, links: x.links.slice(0, 5), linkBateComAvaliacao: linksApp.length && x.links.length ? x.links.map(chave).some((u) => linksApp.includes(u)) : null, avaliadaNoApp: Boolean(aluno.ps[id]) };
  });
  const desafioPadlet = [pad.titulo, ...pad.posts.filter((p) => /desafio|como podemos/i.test(p.titulo + ' ' + p.texto)).map((p) => p.titulo + ' ' + p.texto)].join(' ');
  const desafioP1 = aluno.ps.P1?.desafio || fatos.fioDesafio[0]?.desafio || '';
  const sem = desafioP1 ? sobreposicao(desafioP1, desafioPadlet) : null;
  return {
    titulo: pad.titulo, secoes: pad.secoes.map((s) => s.titulo), totalPosts: pad.posts.length,
    porP: linhas,
    faltamNoPadlet: linhas.filter((l) => !l.presente).map((l) => l.p),
    entreguesMasForaDoPadlet: linhas.filter((l) => !l.presente && l.avaliadaNoApp).map((l) => l.p),
    noPadletSemAvaliacao: linhas.filter((l) => l.presente && !l.avaliadaNoApp).map((l) => l.p),
    temSobreMim: pad.secoes.some((s) => /sobre|quem sou|apresenta/i.test(s.titulo)) || pad.posts.some((p) => /quem sou|sobre mim/i.test(p.titulo)),
    temDesafio: pad.secoes.some((s) => /desafio/i.test(s.titulo)) || /como podemos/i.test(desafioPadlet),
    semelhancaDesafioP1: sem === null ? null : Math.round(sem * 100),
    postsSemP: semP.slice(0, 8)
  };
}

module.exports = { verificar, padronizar, lerPelaApi, pDoTitulo, apiConfigurada: () => Boolean(API_KEY) };
