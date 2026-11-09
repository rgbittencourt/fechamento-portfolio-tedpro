// Gera P1.json ... P6.json no formato real de cada Avaliador, com a turma "TEDPRO 2026 · Calabresa" e casos difíceis.
const fs = require('fs');
const R = require(__dirname + '/../rubricas.json');
const dir = process.argv[2] || '/tmp/fech-dados';
fs.mkdirSync(dir, { recursive: true });

const alunos = [
  { nome: 'Ana Paula Souza', mat: '202614000101', desafio: 'Como podemos apoiar os técnicos de manutenção recém-contratados da Metalúrgica Sul, em Joinville, a seguir os procedimentos de segurança das máquinas usando recursos digitais?', publico: 'técnicos de manutenção recém-contratados da Metalúrgica Sul', nivel: [0.9, 0.85, 0.9, 0.95, 0.9, 0.95] },
  { nome: 'Bruno Henrique Lima', mat: '202614000102', desafio: 'Como podemos engajar os estudantes do curso técnico em Enfermagem do IFSC nas aulas práticas de farmacologia utilizando simulações digitais?', publico: 'estudantes do curso técnico em Enfermagem do IFSC', nivel: [0.6, 0.65, 0.7, 0.8, 0.85, 0.9], derivaP6: false },
  { nome: 'Carla Mendes Oliveira', mat: '202614000103', desafio: 'Como podemos qualificar o atendimento ao cliente dos vendedores de uma loja de materiais de construção em Palhoça com apoio de vídeos curtos?', publico: 'vendedores da loja de materiais de construção', nivel: [0.95, 0.9, 0.6, 0.65, 0.55, 0.7], derivaDe: 'P4', desafio2: 'Como podemos ensinar empreendedorismo digital para jovens de comunidades periféricas usando redes sociais?' },
  { nome: 'Daniel Costa', mat: '202614000104', desafio: 'Como podemos melhorar a educação com tecnologia?', publico: 'alunos', nivel: [0.4, 0.5, 0.45, 0.5, null, null] },
  { nome: 'Érica dos Santos Ramos', mat: '202614000105', desafio: 'Como podemos reduzir a evasão dos cursistas do Polo UAB de Codó no primeiro semestre usando um agente de IA de acompanhamento?', publico: 'cursistas ingressantes do Polo UAB de Codó', nivel: [0.8, 0.75, 0.85, 0.7, 0.95, 0.85], semMatP4: true, nomeVariante: 'Erica Santos Ramos' },
  { nome: 'Fábio Augusto Pereira', mat: '202614000106', desafio: 'Como podemos capacitar voluntários da ONG Mãos Dadas, de São José, a organizar campanhas de arrecadação com ferramentas digitais de gestão?', publico: 'voluntários da ONG Mãos Dadas', nivel: [0.85, 0.8, 0.8, 0.85, 0.8, 0.6], iaSemDescricao: true }
];
const PS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const nivelDe = (c, f) => { // escolhe um nível próximo de f (fração do máximo)
  const alvo = c.max * f; return Math.round(alvo / (c.max / 4)) * (c.max / 4) > c.max ? c.max : Math.round(alvo / (c.max / 4)) * (c.max / 4);
};
const variacao = (i, k) => ((i * 7 + k.length * 3) % 5 - 2) * 0.06;

function avaliacao(p, a, i) {
  const f = a.nivel[PS.indexOf(p)];
  if (f === null) return null;
  const crit = R[p].map((c) => ({ ...c, pts: Math.max(0, Math.min(c.max, nivelDe(c, Math.min(1, Math.max(0, f + variacao(i, c.k)))))) }));
  const total = Math.round(crit.reduce((s, c) => s + c.pts / c.max, 0) / crit.length * 1000) / 100;
  const desafio = a.derivaDe && PS.indexOf(p) >= PS.indexOf(a.derivaDe) ? a.desafio2 : a.desafio;
  const obs = (c) => c.pts < c.max ? `Faltou aprofundar: ${c.label.toLowerCase().slice(0, 60)}.` : '';
  const base = { id: `${p.toLowerCase()}-${a.mat}`, nome: (p === 'P4' && a.nomeVariante) ? a.nomeVariante : a.nome, matricula: (p === 'P4' && a.semMatP4) ? '' : a.mat, orientador: i % 2 ? 'Prof. Rogério Gonçalves Bittencourt' : 'Profa. Maria Silva', desafio, total, feedback: `Olá, ${a.nome.split(' ')[0]},\n\nSeu trabalho na ${p} mostra empenho.\n\nUm abraço,\nProf. Rogério`, updatedAt: '2026-10-01T10:00:00Z' };
  const ia = a.iaSemDescricao ? { iaDeclaracao: 'Sim', iaDescricao: 'ChatGPT' } : { iaDeclaracao: i % 3 ? 'Não' : 'Sim', iaDescricao: i % 3 ? '' : 'Usei o ChatGPT para revisar a ortografia e organizar tópicos, conferindo todas as sugestões.' };
  const scoresObj = Object.fromEntries(crit.map((c) => [c.k, { points: c.pts, observation: obs(c) }]));
  const links = { P2: `https://youtu.be/video${i}`, P4: `https://open.spotify.com/episode/ep${i}`, P5: `https://gemini.google.com/gem/gem${i}` };
  switch (p) {
    case 'P1': return { ...base, ...ia, propostasLista: `A. Eu gostaria de ${a.publico.split(' ').slice(0, 3).join(' ')} mais preparados.\nB. Eu gostaria de melhorar materiais.`, justificativa: `Trabalho com ${a.publico} há anos. Em 2025, segundo levantamento interno, 40% relataram dificuldades.`, resultadosEsperados: i === 2 ? 'Alunos melhores e mais felizes.' : `Espero ver ${a.publico} mais autônomos e seguros.`, coerenciaEtiqueta: i === 2 ? 'Frágil' : 'Coerente', coerenciaMotivo: i === 2 ? 'Os resultados são genéricos.' : 'Os resultados respondem ao problema.', scores: scoresObj, manualAlerts: i === 3 ? 'Item 3: a pergunta não indica relação com tecnologias digitais.' : '' };
    case 'P2': return { ...base, ...ia, cena1Voz: `Olá! Meu desafio envolve ${a.publico}.`, cena2Voz: 'Hoje eles enfrentam dificuldades no dia a dia.', cena3Voz: 'Por isso escolhi este desafio.', linkVideo: links.P2, videoDuracao: i === 3 ? '3:40' : '1:55', scores: scoresObj, pontos: 0, manualAlerts: i === 3 ? 'Vídeo acima de 2 minutos.' : '' };
    case 'P3': return { ...base, ...ia, publicoAlvo: a.publico, objetivo: 'Ao final, os participantes serão capazes de aplicar os procedimentos.', metodologias: 'Aprendizagem baseada em problemas, com estudos de caso.', recursos: 'Moodle, vídeos curtos e quiz no Kahoot.', avaliacaoTexto: i === 3 ? '' : 'Avaliação por rubrica de desempenho na atividade prática.', pontuacoes: Object.fromEntries(crit.map((c) => [c.k, c.pts])), observacoes: Object.fromEntries(crit.map((c) => [c.k, obs(c)])), alertas: i === 3 ? ['Estratégia de avaliação não informada.'] : [], salvoEm: '2026-10-05T10:00:00Z' };
    case 'P4': return { ...base, orientadorIndicado: base.orientador, publicoAlvo: a.derivaDe ? 'jovens de comunidades periféricas' : a.publico, roteiro: 'Abertura, entrevista e fechamento.', contribuicao: `O podcast ajuda ${a.publico} a entender o tema.`, relato: 'Gravei no celular e editei no Audacity.', linkPodcast: links.P4, duracao: '8:30', iaUsada: ia.iaDeclaracao, iaDescricao: ia.iaDescricao, scores: Object.fromEntries(crit.map((c) => [c.k, c.pts])), observacoesCriterios: Object.fromEntries(crit.map((c) => [c.k, obs(c)])), alertasManuais: [], timestamp: '2026-10-10T10:00:00Z' };
    case 'P5': return { ...base, ...ia, demanda: `Responder dúvidas frequentes de ${a.publico}.`, publicoContexto: a.publico, nomeGem: 'Assistente', linkGem: links.P5, evidenciasTeste: i === 4 ? 'Testei com 12 cursistas; 10 disseram que o agente ajudou a organizar a rotina.' : 'Testei sozinho com três perguntas.', funcionouBem: 'Respostas claras.', precisaMelhorar: 'Às vezes inventa informações.', contribuicao: 'O agente apoia o desafio.', agentAnalysis: 'Agente com instruções boas, mas poucas fontes.', scores: scoresObj, manualAlerts: '' };
    case 'P6': return { ...base, iaFerramentas: ia.iaDeclaracao === 'Sim' ? 'ChatGPT' : 'Não utilizei IA.', titulo: `Relato: ${a.publico}`, resumo: 'Este relato apresenta o percurso do portfólio.', publicoAlvo: a.publico, contextualizacao: 'Sou profissional da área.', recursoP2: `Produzi um vídeo: ${links.P2}`, recursoP4: i === 1 ? 'O podcast foi gravado.' : `Podcast disponível em ${i === 0 ? links.P4 : 'https://open.spotify.com/episode/outro'}`, recursoP5: `Criei um agente: ${links.P5}`, resultados: i === 0 ? 'A aplicação com 15 técnicos reduziu dúvidas, segundo questionário.' : 'O projeto foi um sucesso e transformou a realidade.', proximosPassos: 'Ampliar para outros setores.', scores: scoresObj, manualAlerts: '', palavrasResumo: 120 };
  }
}
for (const p of PS) {
  const avs = alunos.map((a, i) => avaliacao(p, a, i)).filter(Boolean);
  const base = { version: 2, turmas: [
    { id: `calabresa-${p.toLowerCase()}`, nome: p === 'P4' ? 'Turma Calabresa 2026' : 'TEDPRO 2026 · Calabresa', avaliacoes: avs },
    { id: 'marguerita', nome: 'TEDPRO 2026 · Marguerita', avaliacoes: [] }
  ] };
  fs.writeFileSync(`${dir}/${p}.json`, JSON.stringify(base, null, 1));
}
console.log('ok', dir);
