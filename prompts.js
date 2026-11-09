// Prompts do dossiê do aluno e do relatório da turma.
// A IA recebe os FATOS calculados (iguais a cada rodada) e trechos das entregas, e só interpreta.
const { P, ORDEM_P } = require('./fontes');

const corta = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n) + ' […]' : s; };
const semTravessao = (s) => String(s || '').replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',');

// Ordem de importância dos campos de cada P (os primeiros recebem mais espaço).
const PRIORIDADE = {
  P1: ['desafio', 'justificativa', 'resultadosEsperados', 'propostasLista', 'propostasDetalhe', 'coerenciaEtiqueta', 'coerenciaMotivo'],
  P2: ['desafio', 'cena1Voz', 'cena2Voz', 'cena3Voz', 'cena4Voz', 'cena5Voz', 'linkVideo', 'videoDuracao', 'videoObservacao', 'cena1Img', 'cena2Img', 'cena3Img'],
  P3: ['desafio', 'publicoAlvo', 'objetivo', 'metodologias', 'recursos', 'avaliacaoTexto', 'conteudos', 'tipo', 'cargaHoraria', 'participantes'],
  P4: ['desafio', 'publicoAlvo', 'contribuicao', 'relato', 'diretrizes', 'roteiro', 'linkPodcast', 'duracao', 'transcricao'],
  P5: ['desafio', 'demanda', 'publicoContexto', 'contribuicao', 'evidenciasTeste', 'funcionouBem', 'precisaMelhorar', 'ajustes', 'objetivoTeste', 'resultadoEsperado', 'descricaoGem', 'nomeGem', 'linkGem', 'fontesConhecimento', 'instrucoesGem', 'agentAnalysis'],
  P6: ['titulo', 'resumo', 'desafio', 'publicoAlvo', 'contextualizacao', 'resultados', 'proximosPassos', 'recursoP2', 'recursoP3', 'recursoP4', 'recursoP5', 'recursoP6', 'reflexaoCompetencias', 'fechamento', 'quadroCompetencias', 'palavrasChave', 'linkDocumento']
};

function blocoEntrega(av, limite) {
  const def = P[av.p];
  const ordem = [...PRIORIDADE[av.p], ...Object.keys(av.textos).filter((k) => !PRIORIDADE[av.p].includes(k))];
  let resto = limite;
  const partes = [];
  for (const k of ordem) {
    const t = av.textos[k]; if (!t || resto <= 0) continue;
    const n = Math.max(250, Math.min(t.texto.length, Math.floor(resto * 0.4)));
    const trecho = corta(t.texto, n); resto -= trecho.length;
    partes.push(`- ${t.rotulo}: ${trecho}`);
  }
  const crit = av.criterios.map((c) => `  · ${c.label}: ${c.pontos === null ? 'não avaliado' : `${c.pontos}/${c.max}`}${c.pontos !== null && c.pontos < c.max && c.observacao ? ` (avaliador: ${corta(c.observacao, 220)})` : ''}`).join('\n');
  return `===== ${av.p} · ${def.titulo} (nota ${av.total ?? 'sem nota'}/10${av.completa ? '' : ', avaliação incompleta'}) =====
O QUE O ESTUDANTE ESCREVEU E ENTREGOU
${partes.join('\n') || '- (sem textos registrados)'}
Declaração de IA: ${av.iaDeclaracao || 'sem registro'}${av.iaDescricao ? `. ${corta(av.iaDescricao, 300)}` : ''}
RUBRICA (pontos obtidos e observações do avaliador nos critérios abaixo do máximo)
${crit}
${av.alertas.length ? `Alertas do avaliador: ${av.alertas.slice(0, 6).map((a) => corta(a, 160)).join(' | ')}\n` : ''}${av.feedback ? `Feedback enviado ao estudante: ${corta(av.feedback, 900)}\n` : ''}${av.analiseCoerencia ? `Análise de coerência registrada: ${corta(av.analiseCoerencia, 900)}\n` : ''}`;
}

const VERIFICACOES = [
  ['desafio_mantido', 'O desafio definido na P1 é o mesmo trabalhado até a P6 (ou a mudança foi explicada pelo estudante)?'],
  ['publico_coerente', 'O público-alvo se mantém coerente da P1 à P6?'],
  ['produtos_dialogam', 'Os produtos P2 a P5 dialogam entre si e com o desafio (um aproveita ou aprofunda o outro), em vez de serem entregas isoladas?'],
  ['relato_fiel', 'O relato (P6) descreve com fidelidade o que foi de fato entregue nas P2 a P5, sem afirmar o que não aparece nas entregas?'],
  ['resultados_com_evidencia', 'Os resultados afirmados (na P5 e na P6) têm evidências concretas nas entregas, como testes, dados de aplicação ou falas do público?'],
  ['feedback_incorporado', 'As fragilidades apontadas pelos avaliadores nas primeiras Ps aparecem superadas ou retomadas nas seguintes?'],
  ['ia_transparente', 'A declaração de uso de IA é consistente e transparente ao longo das Ps?'],
  ['promessa_p1_cumprida', 'O que o estudante disse na P1 que pretendia alcançar foi alcançado, ou ao menos discutido criticamente, na P6?']
];

function montarPromptDossie(aluno, fatos, padlet) {
  const avs = ORDEM_P.map((id) => aluno.ps[id]).filter(Boolean);
  const limite = Math.floor(60000 / Math.max(avs.length, 1));
  const entregas = avs.map((av) => blocoEntrega(av, limite)).join('\n');
  const { linksPorP, ...fatosSemLinks } = fatos;
  return `Você é um avaliador experiente da Especialização TEDPRO (Tecnologias para Educação Profissional e Tecnológica, IFSC) e prepara o DOSSIÊ DE BANCA de um estudante para o professor orientador e os professores da banca. O estudante construiu, ao longo do curso, um portfólio em seis entregas no Padlet:
P1 Descobrindo meu desafio (pergunta-desafio "Como podemos..."), P2 Apresentando meu desafio (roteiro e vídeo), P3 Proposta formativa, P4 Podcast, P5 Agente de IA (Gem), P6 Relato de experiência.
Todas as Ps devem girar em torno do MESMO desafio e do MESMO público-alvo. A banca quer saber se houve um percurso coerente e uma aprendizagem real, e não apenas seis tarefas cumpridas.

SEU PAPEL
Ler TODAS as entregas em conjunto, cruzar o que foi escrito em cada uma com o que foi entregue nas outras e com as avaliações, e entregar ao professor uma leitura que ele não teria lendo as Ps separadamente.

REGRAS DE EVIDÊNCIA
- Baseie TODA afirmação nos dados abaixo. Sempre que afirmar algo, indique as Ps de onde vem ("ps").
- Os FATOS CALCULADOS são exatos (notas, médias, temas, semelhança entre textos, links): use-os, não os recalcule e não os contradiga.
- A semelhança entre os desafios é só um SINAL: abaixo de 20% sugere mudança de desafio; entre 20% e 39%, reformulação (mesmo tema, outro recorte de público, local ou foco). Confirme lendo os textos antes de afirmar. Erros de extração do PDF (palavras quebradas, maiúsculas) não contam como mudança.
- Compare também o público-alvo, o local e o orientador informados em cada P; diferenças entre as Ps são material importante para a banca.
- Diferencie o que o estudante AFIRMA do que DEMONSTRA com evidências.
- Se uma informação não existe nos dados, diga que não há registro; não invente.
- Cite trechos curtos (até 20 palavras) entre aspas quando ajudarem.
- Não use travessão (—) em nenhum texto.

PERGUNTAS PARA A BANCA (o mais importante)
Elabore de 3 a 5 perguntas que:
- cruzem pelo menos duas Ps, ou confrontem o que o estudante escreveu com o que entregou, ou explorem uma tensão, contradição, lacuna ou salto não explicado;
- citem algo específico deste estudante (um público, uma escolha, um resultado, uma frase);
- não possam ser respondidas com sim ou não, nem com uma definição decorada;
- sejam justas: também podem pedir que o estudante desenvolva um ponto forte ou projete a continuidade.
Para cada pergunta, explique por que perguntar e o que uma boa resposta mostraria.
Evite perguntas genéricas como "fale sobre seu projeto" ou "o que você aprendeu".

VERIFICAÇÕES OBJETIVAS (responda a todas, sempre as mesmas, com "sim", "parcial", "nao" ou "sem_dados", e uma evidência curta)
${VERIFICACOES.map(([k, q]) => `- ${k}: ${q}`).join('\n')}

FATOS CALCULADOS PELO APLICATIVO
${JSON.stringify(fatosSemLinks)}
Links registrados por P: ${JSON.stringify(linksPorP)}
${padlet ? `CONFERÊNCIA DO PADLET DO ESTUDANTE\n${JSON.stringify(padlet)}\n` : 'CONFERÊNCIA DO PADLET: ainda não realizada.\n'}
ENTREGAS DO ESTUDANTE
${entregas}

Responda APENAS em JSON válido, neste formato:
{"sintese":"2 parágrafos: quem é o estudante e seu contexto, qual é o desafio, como foi a trajetória e o nível geral do portfólio",
"fio_do_desafio":{"resumo":"um parágrafo","etapas":[{"p":"P1","o_que_fez":"uma frase","ligacao_com_desafio":"forte|parcial|fraca","evidencia":"trecho ou fato"}]},
"verificacoes":{${VERIFICACOES.map(([k]) => `"${k}":{"resposta":"sim","evidencia":"","ps":["P1"]}`).join(',')}},
"pontos_fortes":[{"texto":"","ps":["P2"]}],
"fragilidades":[{"texto":"","ps":["P3"]}],
"contradicoes":[{"descricao":"","ps":["P1","P6"]}],
"evolucao":"um parágrafo sobre a aprendizagem ao longo do curso: o que melhorou, o que persistiu, usando os temas persistentes e superados",
"perguntas_banca":[{"pergunta":"","por_que":"","ps":["P1","P6"],"o_que_observar":""}],
"sugestoes_continuidade":[{"sugestao":"","por_que":""}],
"atencao_banca":["pendências, alertas, lacunas do Padlet ou dados ausentes que a banca deve considerar"],
"parecer_orientador":"2 a 3 parágrafos ao professor orientador e à banca, com a leitura de conjunto e a recomendação de foco para a arguição"}`;
}

function montarPromptTurma(nomeTurma, fatosTurma, resumos) {
  return `Você apoia a coordenação da Especialização TEDPRO (IFSC) no fechamento do portfólio da turma "${nomeTurma}". Os estudantes fizeram seis entregas em torno de um mesmo desafio: P1 Descobrindo meu desafio, P2 Roteiro e vídeo, P3 Proposta formativa, P4 Podcast, P5 Agente de IA (Gem), P6 Relato de experiência.

TAREFA
Produza uma leitura de conjunto para os professores da banca e para a coordenação: insights, tendências, maiores problemas e maiores acertos da turma, relações entre as Ps e recomendações.

REGRAS
- Use os FATOS DA TURMA como base exata (médias, funil de entregas, critérios mais frágeis e mais fortes, correlações, temas). Não recalcule nem contradiga.
- Cada insight deve trazer a evidência que o sustenta (números, Ps, quantos estudantes).
- Procure relações: onde os estudantes param, que tema fraco na P1 continua fraco no fim, se quem vai bem numa P vai bem em outra (correlações), se os desafios mudaram de foco, como a turma declarou o uso de IA.
- Uma correlação calculada com poucos estudantes é só um indício; diga isso quando n for pequeno.
- Fale de estudantes pelo nome só em "alunos_atencao" e "destaques".
- Não use travessão (—).

FATOS DA TURMA (calculados pelo aplicativo)
${JSON.stringify(fatosTurma)}

RESUMO DE CADA ESTUDANTE
${resumos.map((r) => JSON.stringify(r)).join('\n')}

Responda APENAS em JSON válido:
{"panorama":"2 parágrafos",
"tendencias":[{"titulo":"","descricao":"","evidencia":""}],
"maiores_acertos":[{"titulo":"","descricao":"","evidencia":""}],
"maiores_problemas":[{"titulo":"","descricao":"","evidencia":""}],
"relacoes_entre_ps":[{"titulo":"","descricao":"","evidencia":""}],
"perfil_dos_desafios":"um parágrafo sobre públicos, contextos e tecnologias escolhidos pela turma",
"alunos_atencao":[{"nome":"","motivo":""}],
"destaques":[{"nome":"","motivo":""}],
"recomendacoes_banca":[""],
"recomendacoes_proxima_oferta":[""]}`;
}

// Padroniza a saída do dossiê (listas, valores permitidos, sem travessão).
function limparDossie(r = {}) {
  const lista = (v) => (Array.isArray(v) ? v : []);
  const t = (v) => semTravessao(String(v || '').trim());
  const ps = (v) => lista(v).map(String).filter((x) => /^P[1-6]$/.test(x));
  const respostas = ['sim', 'parcial', 'nao', 'sem_dados'];
  const verificacoes = {};
  for (const [k, q] of VERIFICACOES) {
    const x = (r.verificacoes || {})[k] || {};
    const resp = String(x.resposta || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
    verificacoes[k] = { pergunta: q, resposta: respostas.includes(resp) ? resp : 'sem_dados', evidencia: t(x.evidencia), ps: ps(x.ps) };
  }
  return {
    sintese: t(r.sintese),
    fio_do_desafio: { resumo: t(r.fio_do_desafio?.resumo), etapas: lista(r.fio_do_desafio?.etapas).map((e) => ({ p: String(e.p || ''), o_que_fez: t(e.o_que_fez), ligacao: ['forte', 'parcial', 'fraca'].includes(e.ligacao_com_desafio) ? e.ligacao_com_desafio : '', evidencia: t(e.evidencia) })) },
    verificacoes,
    pontos_fortes: lista(r.pontos_fortes).map((x) => ({ texto: t(x.texto), ps: ps(x.ps) })).filter((x) => x.texto),
    fragilidades: lista(r.fragilidades).map((x) => ({ texto: t(x.texto), ps: ps(x.ps) })).filter((x) => x.texto),
    contradicoes: lista(r.contradicoes).map((x) => ({ descricao: t(x.descricao), ps: ps(x.ps) })).filter((x) => x.descricao),
    evolucao: t(r.evolucao),
    perguntas_banca: lista(r.perguntas_banca).map((x) => ({ pergunta: t(x.pergunta), por_que: t(x.por_que), ps: ps(x.ps), o_que_observar: t(x.o_que_observar) })).filter((x) => x.pergunta).slice(0, 5),
    sugestoes_continuidade: lista(r.sugestoes_continuidade).map((x) => ({ sugestao: t(x.sugestao), por_que: t(x.por_que) })).filter((x) => x.sugestao),
    atencao_banca: lista(r.atencao_banca).map(t).filter(Boolean),
    parecer_orientador: t(r.parecer_orientador)
  };
}

function limparTurma(r = {}) {
  const lista = (v) => (Array.isArray(v) ? v : []);
  const t = (v) => semTravessao(String(v || '').trim());
  const itens = (v) => lista(v).map((x) => ({ titulo: t(x.titulo), descricao: t(x.descricao), evidencia: t(x.evidencia) })).filter((x) => x.titulo || x.descricao);
  return {
    panorama: t(r.panorama), tendencias: itens(r.tendencias), maiores_acertos: itens(r.maiores_acertos), maiores_problemas: itens(r.maiores_problemas),
    relacoes_entre_ps: itens(r.relacoes_entre_ps), perfil_dos_desafios: t(r.perfil_dos_desafios),
    alunos_atencao: lista(r.alunos_atencao).map((x) => ({ nome: t(x.nome), motivo: t(x.motivo) })).filter((x) => x.nome),
    destaques: lista(r.destaques).map((x) => ({ nome: t(x.nome), motivo: t(x.motivo) })).filter((x) => x.nome),
    recomendacoes_banca: lista(r.recomendacoes_banca).map(t).filter(Boolean), recomendacoes_proxima_oferta: lista(r.recomendacoes_proxima_oferta).map(t).filter(Boolean)
  };
}

module.exports = { montarPromptDossie, montarPromptTurma, limparDossie, limparTurma, VERIFICACOES, blocoEntrega };
