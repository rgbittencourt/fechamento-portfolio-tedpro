// As seis entregas do portfólio TEDPRO e como ler os dados de cada Avaliador.
// Cada Avaliador guarda {version, turmas:[{id, nome, avaliacoes:[...]}]} em dados/turmas.json
// no seu repositório "-dados". Só o jeito de gravar notas e alguns campos muda entre eles.

const RUBRICAS = require('./rubricas.json');

const OWNER = process.env.GITHUB_DATA_OWNER || 'rgbittencourt';

const TEMAS = {
  desafio: 'Desafio e público-alvo',
  fundamentacao: 'Fundamentação e motivação',
  planejamento: 'Planejamento pedagógico',
  tecnologia: 'Tecnologias digitais',
  producao: 'Produção e linguagem midiática',
  reflexao: 'Teste, análise e reflexão',
  forma: 'Forma e modelo da entrega',
  ia: 'Transparência no uso de IA'
};

// Campos de texto relevantes para o cruzamento, com rótulos legíveis.
const P = {
  P1: {
    nome: 'P1', titulo: 'Descobrindo meu desafio', produto: 'definição do desafio',
    repo: process.env.REPO_P1 || 'avaliador-p1-definicao-desafio-dados',
    campos: {
      desafio: 'Pergunta-desafio', propostasLista: 'Propostas do entorno (item 1)', propostasDetalhe: 'Aprofundamento das propostas (item 2)',
      justificativa: 'Por que escolheu o desafio (item 4)', resultadosEsperados: 'O que pretende alcançar (item 5)',
      coerenciaEtiqueta: 'Coerência desafio → resultados (etiqueta)', coerenciaMotivo: 'Coerência desafio → resultados (motivo)'
    },
    publico: () => ''
  },
  P2: {
    nome: 'P2', titulo: 'Apresentando meu desafio (roteiro e vídeo)', produto: 'roteiro e vídeo de apresentação do desafio',
    repo: process.env.REPO_P2 || 'avaliador-p2-dados',
    campos: {
      desafio: 'Desafio', cena1Voz: 'Cena 1 (voz)', cena1Img: 'Cena 1 (imagem)', cena2Voz: 'Cena 2 (voz)', cena2Img: 'Cena 2 (imagem)',
      cena3Voz: 'Cena 3 (voz)', cena3Img: 'Cena 3 (imagem)', cena4Voz: 'Cena 4 (voz)', cena4Img: 'Cena 4 (imagem)', cena5Voz: 'Cena 5 (voz)', cena5Img: 'Cena 5 (imagem)',
      linkVideo: 'Link do vídeo', videoDuracao: 'Duração do vídeo', videoObservacao: 'Observações sobre o vídeo', obsLinguagens: 'Linguagens do roteiro'
    },
    publico: () => ''
  },
  P3: {
    nome: 'P3', titulo: 'Proposta formativa', produto: 'proposta formativa',
    repo: process.env.REPO_P3 || 'avaliador-p3-proposta-formativa-dados',
    campos: {
      desafio: 'Desafio', publicoAlvo: 'Público-alvo', objetivo: 'Objetivo de aprendizagem', conteudos: 'Conteúdos', metodologias: 'Metodologias',
      tipo: 'Tipo de formação', cargaHoraria: 'Carga horária', participantes: 'Participantes', recursos: 'Recursos e tecnologias', avaliacaoTexto: 'Avaliação'
    },
    publico: (a) => a.publicoAlvo
  },
  P4: {
    nome: 'P4', titulo: 'Podcast', produto: 'podcast',
    repo: process.env.REPO_P4 || 'avaliador-podcast-dados',
    campos: {
      desafio: 'Desafio', publicoAlvo: 'Público-alvo', diretrizes: 'Diretrizes do podcast', roteiro: 'Roteiro', contribuicao: 'Contribuição para o desafio',
      relato: 'Relato da elaboração', transcricao: 'Transcrição do podcast', linkPodcast: 'Link do podcast', duracao: 'Duração'
    },
    publico: (a) => a.publicoAlvo
  },
  P5: {
    nome: 'P5', titulo: 'Agente de IA (Gem)', produto: 'agente de IA',
    repo: process.env.REPO_P5 || 'avaliador-p5-agente-ia-dados',
    campos: {
      desafio: 'Desafio', demanda: 'Demanda do agente', publicoContexto: 'Público e contexto', resultadoEsperado: 'Resultado esperado',
      nomeGem: 'Nome do agente', linkGem: 'Link do agente', descricaoGem: 'Descrição do agente', instrucoesGem: 'Instruções do agente',
      fontesConhecimento: 'Fontes de conhecimento', objetivoTeste: 'Objetivo do teste', evidenciasTeste: 'Evidências do teste',
      funcionouBem: 'O que funcionou bem', precisaMelhorar: 'O que precisa melhorar', ajustes: 'Ajustes feitos', contribuicao: 'Contribuição para o desafio',
      agentAnalysis: 'Análise complementar do agente (professor)'
    },
    publico: (a) => a.publicoContexto
  },
  P6: {
    nome: 'P6', titulo: 'Relato de experiência', produto: 'relato de experiência',
    repo: process.env.REPO_P6 || 'avaliador-p6-relato-de-experiencia-dados',
    campos: {
      titulo: 'Título do relato', resumo: 'Resumo', palavrasChave: 'Palavras-chave', contextualizacao: 'Contextualização', desafio: 'Desafio', publicoAlvo: 'Público-alvo',
      recursoP2: 'Reflexão sobre a P2', recursoP3: 'Reflexão sobre a P3', recursoP4: 'Reflexão sobre a P4', recursoP5: 'Reflexão sobre a P5', recursoP6: 'Reflexão sobre a P6',
      quadroCompetencias: 'Quadro de competências', reflexaoCompetencias: 'Autoavaliação de competências', resultados: 'Resultados da aplicação',
      proximosPassos: 'Próximos passos', fechamento: 'Fechamento', linkDocumento: 'Link do documento'
    },
    publico: (a) => a.publicoAlvo
  }
};
const ORDEM_P = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
for (const id of ORDEM_P) P[id].rubrica = RUBRICAS[id];

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const txt = (v) => (v == null ? '' : Array.isArray(v) ? v.join('\n') : typeof v === 'object' ? '' : String(v)).trim();

// Pontos de um critério, nos três formatos usados pelos Avaliadores.
function pontos(a, k) {
  const s = a.scores && a.scores[k];
  if (s !== undefined && s !== null) return typeof s === 'object' ? num(s.points ?? s.pontos) : num(s); // P1, P2, P5, P6 | P4
  const p = a.pontuacoes && a.pontuacoes[k]; // P3
  if (p !== undefined && p !== null) return typeof p === 'object' ? num(p.pontos ?? p.points) : num(p);
  return null;
}
function observacao(a, k) {
  const s = a.scores && a.scores[k];
  if (s && typeof s === 'object' && s.observation) return txt(s.observation);
  return txt((a.observacoesCriterios || {})[k] || (a.observacoes || {})[k] || (a.justificativas || {})[k]);
}
function alertas(a) {
  const lista = [];
  const add = (v) => { if (!v) return; if (Array.isArray(v)) v.forEach(add); else if (typeof v === 'object') add(v.texto || v.mensagem || v.text); else String(v).split('\n').map((s) => s.trim()).filter(Boolean).forEach((s) => lista.push(s)); };
  add(a.manualAlerts); add(a.alertasManuais); add(a.alertas);
  return [...new Set(lista)];
}
// "Sim", "Não", "Ambos" ou "" a partir dos campos de declaração de IA.
function declaracaoIA(a, id) {
  const bruto = txt(a.iaDeclaracao || a.iaUsada);
  if (/ambos|sim e n[ãa]o/i.test(bruto)) return 'Ambos';
  if (/^s/i.test(bruto)) return 'Sim';
  if (/^n/i.test(bruto)) return 'Não';
  if (id === 'P6') { const f = txt(a.iaFerramentas); if (f) return /n[ãa]o (utilizei|usei|fiz uso)|nenhuma/i.test(f) ? 'Não' : 'Sim'; }
  return '';
}
// Remove o enunciado do modelo que às vezes vem junto na extração ("Se sim, descreva...").
const ENUNCIADO_IA = /^\s*[:.]?\s*$|se sim,? descreva|quais ferramentas foram utilizadas|para quais finalidades; como ocorreu|adapta[çc][õo]es, revis[õo]es e valida[çc][õo]es foram realizadas|com a ia; quais|de que\s*$|forma o uso da ia contribuiu para o resultado final/i;
function descricaoIA(a) {
  const bruto = [a.iaDescricao, a.iaFerramentas, a.iaFinalidades, a.iaValidacao, a.iaImpacto].map(txt).filter(Boolean).join('\n');
  return bruto.split('\n').filter((l) => !ENUNCIADO_IA.test(l)).join('\n').trim();
}
function orientador(a) { return txt(a.orientadorCorreto || a.orientador || a.orientadorIndicado); }

// Converte uma avaliação de qualquer Avaliador para um formato comum.
function normalizar(id, a) {
  const def = P[id];
  const criterios = def.rubrica.map((c) => {
    const pts = pontos(a, c.k);
    return { k: c.k, label: c.label, tema: c.tema, max: c.max, pontos: pts, pct: pts === null ? null : Math.round((pts / c.max) * 100), observacao: observacao(a, c.k) };
  });
  const avaliados = criterios.filter((c) => c.pontos !== null);
  let total = num(a.total);
  if (total === null && avaliados.length) total = Math.round(avaliados.reduce((s, c) => s + c.pontos / c.max, 0) / def.rubrica.length * 1000) / 100;
  const textos = {};
  for (const [k, rotulo] of Object.entries(def.campos)) { const v = txt(a[k]); if (v) textos[k] = { rotulo, texto: v }; }
  return {
    p: id, id: a.id, nome: txt(a.nome), matricula: txt(a.matricula), orientador: orientador(a),
    total, completa: avaliados.length === def.rubrica.length, criterios,
    desafio: txt(a.desafio), publico: txt(def.publico(a)),
    iaDeclaracao: declaracaoIA(a, id), iaDescricao: descricaoIA(a),
    alertas: alertas(a), feedback: txt(a.feedback),
    analiseCoerencia: txt(a.analiseCoerencia), feedbackCoerencia: txt(a.feedbackCoerencia),
    textos, atualizadoEm: a.updatedAt || a.salvoEm || a.timestamp || ''
  };
}

module.exports = { P, ORDEM_P, TEMAS, OWNER, normalizar, pontos, declaracaoIA };
