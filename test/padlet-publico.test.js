const test = require('node:test');
const assert = require('node:assert');
const padlet = require('../padlet');
test('lê Padlet público pelos endereços da página', async () => {
  const resp = (body, ok = true) => ({ ok, status: ok ? 200 : 403, text: async () => body, json: async () => JSON.parse(body) });
  const buscar = async (u) => {
    if (u.includes('/10/wishes')) return resp(JSON.stringify({ data: [
      { attributes: { id: 1, wall_id: 9, wall_section_id: 5, subject: 'P1 Descobrindo meu desafio', body: '<p>Como podemos <b>x</b>? https://youtu.be/abc</p>', attachment: 'https://u1.padletusercontent.com/a/P1.pdf?t=1', created_at: '2026-10-01T00:00:00Z', content_updated_at: '2026-11-01T00:00:00Z', published: true } },
      { attributes: { id: 2, wall_id: 9, wall_section_id: 6, subject: '', body: 'rascunho', published: false } }
    ], meta: { next: null } }));
    if (u.includes('/5/wall_sections')) return resp(JSON.stringify({ data: [{ id: '5', attributes: { id: 5, title: 'P1' } }, { id: '6', attributes: { id: 6, title: 'P2' } }] }));
    if (u.includes('/oembed')) return resp(JSON.stringify({ title: 'Meu portfólio', description: 'TEDPRO' }));
    if (u.includes('/embed/')) return resp('<html>… "board_AbCdEfGh12345678" …</html>');
    return resp('<html><title>Meu portfólio</title><meta property="og:description" content="TEDPRO">… "board_AbCdEfGh12345678" …</html>');
  };
  const r = await padlet.lerPublico('https://padlet.com/fulano/portfolio-abc123', { buscar });
  assert.equal(r.titulo, 'Meu portfólio');
  assert.equal(r.posts.length, 1);
  assert.equal(r.secoes.length, 2);
  assert.match(r.posts[0].texto, /Como podemos x/);
  const porP = padlet.postsPorP(r);
  assert.ok(porP.P1 && porP.P1.posts[0].links.includes('https://youtu.be/abc'));
});
test('Padlet privado dá mensagem clara', async () => {
  const buscar = async () => ({ ok: true, status: 200, text: async () => '<html>login</html>' });
  await assert.rejects(padlet.lerPublico('https://padlet.com/x/y', { buscar }), /privado/);
});

test('a seção vale mais que palavras do texto: post da P4 com "roteiro" no texto continua na P4', () => {
  const pad = { titulo: 'x', secoes: [{ id: '2', titulo: 'P2 - Seu desafio em vídeo' }, { id: '4', titulo: 'P4 - Material digital 1' }, { id: '5', titulo: 'P5 - Material digital 2' }],
    posts: [
      { secao: '2', titulo: '', texto: 'PDF do roteiro e o link do video! https://canva.link/a', anexo: 'https://x/P2___Roteiro.pdf' },
      { secao: '4', titulo: '', texto: 'PDF do roteiro e o link do Podcast! https://open.spotify.com/episode/1', anexo: 'https://x/P4___TEMPLATE_PODCAST.pdf' },
      { secao: '5', titulo: '', texto: 'PDF do roteiro e Link de acesso ao Gem: https://gemini.google.com/gem/1', anexo: '' }
    ] };
  const porP = padlet.postsPorP(pad);
  assert.equal(porP.P2.posts.length, 1);
  assert.equal(porP.P4.posts.length, 1);
  assert.equal(porP.P5.posts.length, 1);
  assert.ok(porP.P4.posts[0].links.some((l) => l.includes('spotify')));
});
