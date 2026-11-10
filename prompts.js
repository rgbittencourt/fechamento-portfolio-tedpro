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

const ANGULOS = { fio_do_desafio: 'Fio do desafio', escrito_x_entregue: 'Escrito × entregue', evidencias: 'Evidências', escolhas: 'Escolhas pedagógicas e tecnológicas', aprendizagem: 'Aprendizagem', continuidade: 'Continuidade' };

const VERIFICACOES = [
  ['desafio_mantido', 'O desafio definido na P1 é o mesmo trabalhado até a P6 (ou a mudança foi explicada pelo estudante)?'],
  ['publico_coerente', 'O público-alvo se mantém coerente da P1 à P6?'],
  ['produtos_dialogam', 'Os produtos P2 a P5 dialogam entre si e com o desafio (um aproveita ou aprofunda o outro), em vez de serem entregas isoladas?'],
  ['relato_fiel', 'O relato (P6) descreve com fidelidade o que foi de fato entregue nas P2 a P5, sem afirmar o que não aparece nas entregas?'],
  ['resultados_com_evidencia', 'Os resultados afirmados (na P5 e na P6) têm evidências concretas nas entregas, como testes, dados de aplicação ou falas do público?'],
  ['feedback_incorporado', 'As indicações do orientador foram atendidas nas versões publicadas no Padlet (ou, na etapa preliminar, as fragilidades das primeiras Ps aparecem superadas nas seguintes)?'],
  ['ia_transparente', 'A declaração de uso de IA é consistente e transparente ao longo das Ps?'],
  ['promessa_p1_cumprida', 'O que o estudante disse na P1 que pretendia alcançar foi alcançado, ou ao menos discutido criticamente, na P6?']
];

function montarPromptDossie(aluno, fatos, padlet, correcoes = null, versoes = null) {
  const avs = ORDEM_P.map((id) => aluno.ps[id]).filter(Boolean);
  const limite = Math.floor(60000 / Math.max(avs.length, 1));
  const entregas = avs.map((av) => blocoEntrega(av, limite)).join('\n');
  const { linksPorP, feedbacks, ...fatosSemLinks } = fatos;
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
Elabore EXATAMENTE 6 perguntas, uma de cada ângulo abaixo, na ordem:
1. "fio_do_desafio": a coerência do percurso, retomando o desafio e o público da P1 diante do que aparece nas Ps seguintes (mudanças, recortes, saltos).
2. "escrito_x_entregue": uma contradição, lacuna ou afirmação do estudante que não aparece (ou aparece diferente) nas entregas, nas avaliações ou no Padlet.
3. "evidencias": os resultados e o impacto afirmados (testes da P5, aplicação, falas do público, dados do relato), pedindo que o estudante sustente com evidências.
4. "escolhas": as escolhas pedagógicas e tecnológicas (formato, tecnologia, agente, estratégia de avaliação), pedindo que justifique por que servem a ESTE público e a ESTE desafio, e o que descartou.
5. "aprendizagem": a reflexão sobre o próprio percurso, usando uma fragilidade apontada pelos avaliadores, um tema que persistiu ou foi superado, ou o uso declarado de IA.
6. "continuidade": a projeção do trabalho (próximos passos, ampliação, riscos, sustentabilidade), ancorada no que já foi construído.
Cada pergunta deve:
- citar algo específico deste estudante (um público, uma escolha, um resultado, uma frase entre aspas, um número), de modo que não sirva para nenhum outro estudante;
- cruzar pelo menos duas Ps sempre que os dados permitirem;
- ser aberta: não pode ser respondida com sim ou não, nem com uma definição decorada;
- ser justa e respeitosa, podendo também convidar o estudante a desenvolver um ponto forte;
- ter de uma a três frases, com um breve contexto antes da pergunta propriamente dita.
Para cada uma, explique por que perguntar (a evidência que a motiva) e o que uma boa resposta mostraria.
Se faltar dado para um ângulo, use-o para perguntar sobre a ausência (por exemplo, a P que não foi entregue ou o resultado sem evidência).
Evite perguntas genéricas como "fale sobre seu projeto" ou "o que você aprendeu".

AS PERGUNTAS NASCEM DO PRÓPRIO DOSSIÊ
Elabore as perguntas por ÚLTIMO, depois de escrever o fio do desafio, as verificações, os pontos fortes, as fragilidades, as contradições e a evolução, e A PARTIR deles. A banca deve perceber que cada pergunta decorre do que o dossiê mostrou. Use, nesta ordem de prioridade:
- PERFIL DE TRAJETÓRIA (fatos.perfil): siga a orientação "guia.fazer" do perfil deste estudante. Por exemplo: consistente e alto pede perguntas de aprofundamento (justificar escolhas, limites, continuidade); em queda pede investigar o que mudou e as Ps não entregues; irregular pede relacionar as Ps fortes com as fracas; em ascensão pede o que aprendeu com os primeiros feedbacks; desempenho baixo pede retomar desafio e público e as pendências.
- Verificações respondidas com "nao" ou "parcial": cada uma é candidata natural a pergunta.
- Contradições e fragilidades que você listou, temas persistentes, quedas de nota, deriva ou reformulação do desafio, mudança de público, alertas e, na etapa final, indicações não corrigidas no Padlet.
- Pontos fortes e temas superados: use pelo menos um para convidar o estudante a desenvolver o que fez bem.
Cada pergunta não pode contradizer o que o dossiê afirma (por exemplo, não pergunte sobre uma lacuna que as verificações dizem estar resolvida).
No campo "base", diga em uma frase curta de qual elemento do dossiê a pergunta decorre (por exemplo: "Perfil consistente e alto: aprofundar escolhas"; "Verificação evidencias_resultados = parcial"; "Contradição P1 × P4 sobre o público"; "Tema persistente: teste, análise e reflexão").

VERIFICAÇÕES OBJETIVAS (responda a todas, sempre as mesmas, com "sim", "parcial", "nao" ou "sem_dados", e uma evidência curta)
${VERIFICACOES.map(([k, q]) => `- ${k}: ${q}`).join('\n')}

FATOS CALCULADOS PELO APLICATIVO
${JSON.stringify(fatosSemLinks)}
Links registrados por P: ${JSON.stringify(linksPorP)}
${padlet ? `CONFERÊNCIA DO PADLET DO ESTUDANTE\n${JSON.stringify(padlet)}\n` : 'CONFERÊNCIA DO PADLET: ainda não realizada.\n'}${correcoes ? `
ETAPA FINAL: as versões publicadas no Padlet são os PRODUTOS FINAIS do estudante (as entregas do Moodle não podem ser alteradas; as correções aparecem só no Padlet). Baseie a leitura de conjunto, as fragilidades, as perguntas e o parecer nas versões do Padlet, usando as avaliações do Moodle como histórico. A verificação "feedback_incorporado" deve refletir a VERIFICAÇÃO DAS CORREÇÕES abaixo, e pelo menos uma pergunta para a banca deve tratar de uma indicação não corrigida ou só parcialmente corrigida, se houver.
VERIFICAÇÃO DAS CORREÇÕES (indicações do orientador × versão no Padlet)
${JSON.stringify({ taxa: correcoes.taxa, conta: correcoes.conta, porP: Object.fromEntries(Object.entries(correcoes.porP).map(([k, v]) => [k, { taxa: v.taxa, itens: v.itens.map((i) => `${i.status}: ${i.indicacao}${i.evidencia ? ` (${i.evidencia})` : ''}`).slice(0, 10) }])) })}
VERSÕES FINAIS NO PADLET (trechos)
${Object.entries(versoes || {}).map(([k, v]) => `--- ${k} ---\n${corta(v.texto, 3500) || '(sem texto legível)'}`).join('\n')}
` : `
ETAPA PRELIMINAR: as versões corrigidas ainda não foram lidas do Padlet. Trate este dossiê como preliminar e não afirme se as indicações foram atendidas.
`}
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
"perguntas_banca":[{"angulo":"fio_do_desafio","pergunta":"","por_que":"","ps":["P1","P6"],"o_que_observar":"","base":""}],
"sugestoes_continuidade":[{"sugestao":"","por_que":""}],
"atencao_banca":["pendências, alertas, lacunas do Padlet ou dados ausentes que a banca deve considerar"],
"parecer_orientador":"2 a 3 parágrafos ao professor orientador e à banca, com a leitura de conjunto e a recomendação de foco para a arguição"}`;
}

function montarPromptTurma(nomeTurma, fatosTurma, resumos) {
  return `Você apoia a coordenação da Especialização TEDPRO (IFSC) no fechamento do portfólio da turma "${nomeTurma}". Os estudantes fizeram seis entregas em torno de um mesmo desafio: P1 Descobrindo meu desafio, P2 Roteiro e vídeo, P3 Proposta formativa, P4 Podcast, P5 Agente de IA (Gem), P6 Relato de experiência.

TAREFA
Produza uma leitura de conjunto para os professores da banca e para a coordenação: insights, tendências, maiores problemas e maiores acertos da turma, relações entre as Ps e recomendações. Faça uma leitura PEDAGÓGICA: o que os números dizem sobre a aprendizagem da turma (formular um problema real, planejar uma formação, produzir mídia, testar com o público, refletir sobre a própria prática), em que momento do percurso as dificuldades aparecem e o que os orientadores podem fazer a respeito antes da banca.

COMO OS DADOS FORAM CALCULADOS
- Notas de 0 a 10 em cada P. A média da turma em cada P considera só quem entregou. A média oficial de cada estudante soma as notas e divide pelas 6 Ps (P não entregue conta zero); "mediaEntregues" é a média só das Ps entregues.
- Temas: cada critério das rubricas foi agrupado num tema (desafio e público; fundamentação; planejamento pedagógico; tecnologias digitais; produção e linguagem midiática; teste, análise e reflexão; forma da entrega; transparência no uso de IA). O percentual é a soma dos pontos obtidos sobre o máximo possível, juntando todas as Ps.
- Tema persistente: abaixo de 75% em duas ou mais Ps do mesmo estudante. Tema superado: abaixo de 75% em P1 a P3 e acima de 85% em todas de P4 a P6.
- Correlação (r de Pearson) entre as notas de duas Ps: perto de 1, quem vai bem numa vai bem na outra; perto de 0, sem relação; negativa, relação inversa.
- Perfis de trajetória: calculados com TODAS as Ps que a turma já cursou, com zero na P não entregue: baixo (média < 6), em ascensão ou em queda (tendência das notas), irregular (desvio alto), consistente e alto (média de 8,5 ou mais), estável.

REGRAS
- Use os FATOS DA TURMA como base exata (médias, funil de entregas, critérios mais frágeis e mais fortes, correlações, temas). Não recalcule nem contradiga.
- Cada insight deve trazer a evidência que o sustenta (números, Ps, quantos estudantes).
- Se houver dados de correções (indicações do orientador atendidas nas versões do Padlet), analise quais Ps e que tipos de indicação a turma mais corrigiu e menos corrigiu.
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
"recomendacoes_proxima_oferta":[""],
"leitura_pedagogica":"2 a 3 parágrafos: o que o conjunto revela sobre a aprendizagem da turma ao longo do percurso de P1 a P6, onde estão as dificuldades conceituais (não só de forma) e o que isso pede da orientação",
"leitura_perfis":"um parágrafo interpretando a distribuição dos perfis de trajetória e o que cada grupo precisa",
"acoes_orientacao":[{"acao":"","para_quem":"","por_que":""}]}`;
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
    perguntas_banca: lista(r.perguntas_banca).map((x) => ({ angulo: ANGULOS[x.angulo] ? x.angulo : '', pergunta: t(x.pergunta), por_que: t(x.por_que), ps: ps(x.ps), o_que_observar: t(x.o_que_observar), base: t(x.base) })).filter((x) => x.pergunta).slice(0, 6),
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
    recomendacoes_banca: lista(r.recomendacoes_banca).map(t).filter(Boolean), recomendacoes_proxima_oferta: lista(r.recomendacoes_proxima_oferta).map(t).filter(Boolean),
    leitura_pedagogica: t(r.leitura_pedagogica), leitura_perfis: t(r.leitura_perfis),
    acoes_orientacao: lista(r.acoes_orientacao).map((x) => ({ acao: t(x.acao), para_quem: t(x.para_quem), por_que: t(x.por_que) })).filter((x) => x.acao)
  };
}

// ---------- verificação das correções (indicações do orientador × versão publicada no Padlet) ----------
const STATUS_CORRECAO = ['corrigido', 'parcial', 'nao_corrigido', 'nova_versao', 'nao_verificavel'];
function indicacoesDaP(av) {
  const itens = av.criterios.filter((c) => c.pontos !== null && c.pontos < c.max)
    .map((c) => `- Critério "${c.label}" (${c.pontos}/${c.max})${c.observacao ? `: ${corta(c.observacao, 400)}` : ''}`);
  return `${itens.join('\n') || '- Nenhum critério abaixo do máximo.'}
${av.feedback ? `Feedback enviado ao estudante: ${corta(av.feedback, 1500)}\n` : ''}${av.feedbackCoerencia ? `Feedback de coerência: ${corta(av.feedbackCoerencia, 900)}\n` : ''}${av.alertas.length ? `Alertas do avaliador: ${av.alertas.slice(0, 6).map((a) => corta(a, 160)).join(' | ')}\n` : ''}`;
}
function montarPromptCorrecoes(aluno, versoes, sinais = {}) {
  const blocos = ORDEM_P.filter((id) => aluno.ps[id]).map((id) => {
    const av = aluno.ps[id], v = versoes[id];
    const fontes = v ? v.fontes.map((f) => `${f.nome} (${f.tipo}${f.lido ? ', texto lido' : ', não lido'})`).join('; ') : '';
    const links = v ? v.links.map((l) => l.url).join(' ') : '';
    return `===== ${id} · ${P[id].titulo} (nota no Moodle ${av.total ?? 'sem nota'}/10) =====
INDICAÇÕES DO ORIENTADOR NA AVALIAÇÃO
${indicacoesDaP(av)}
${sinais[id] ? `COMPARAÇÃO DA MÍDIA (avaliada × Padlet): ${JSON.stringify(sinais[id])}\n` : ''}VERSÃO PUBLICADA NO PADLET
${v ? `Arquivos: ${fontes || 'nenhum'}${links ? `\nLinks: ${links}` : ''}\nTexto disponível:\n${v.texto ? corta(v.texto, 9000) : '(nenhum texto legível)'}` : '(esta P não foi encontrada no Padlet)'}`;
  }).join('\n\n');
  return `Você confere, para o professor orientador da Especialização TEDPRO (IFSC), se o estudante ${aluno.nome} atendeu às indicações de melhoria feitas nas avaliações das Ps. As entregas no Moodle não podem ser alteradas: o estudante deve corrigir seus produtos e publicar a versão final no Padlet. Compare, P por P, as indicações do orientador com a versão publicada no Padlet.

REGRAS
- Para cada P, transforme as indicações (critérios abaixo do máximo, observações, feedback, coerência, alertas) em itens objetivos de melhoria, sem repetir o mesmo ponto. Ignore elogios e itens já no máximo.
- Para cada item, procure a evidência na versão do Padlet e classifique:
  "corrigido": a versão do Padlet mostra claramente a correção (cite o trecho);
  "parcial": houve mudança, mas incompleta;
  "nao_corrigido": o texto disponível mostra que o problema continua;
  "nova_versao": vídeo ou áudio (P2, P4) que a COMPARAÇÃO DA MÍDIA mostra ser outra versão (link ou arquivo diferente, publicado depois da avaliação), mas cujo conteúdo não pode ser lido; o orientador deve assistir ou ouvir;
  "nao_verificavel": não há texto legível nem sinal de nova versão para conferir (link externo, PDF escaneado) ou a P não está no Padlet.
- Vídeo e áudio: se a COMPARAÇÃO DA MÍDIA indicar o mesmo link avaliado e nenhuma postagem posterior, classifique como "nao_corrigido" com a evidência "mesma versão avaliada"; se indicar nova versão, use "nova_versao" e cite o link ou arquivo e a data. Indicações sobre o roteiro escrito ou o relato continuam sendo conferidas pelo texto.
- Não presuma correção sem evidência no texto. Não confunda o texto da avaliação com o texto do estudante.
- Evidências: trechos curtos (até 25 palavras) entre aspas, ou a ausência constatada.
- Registre também melhorias relevantes feitas sem terem sido pedidas, se houver.
- Não use travessão (—).

${blocos}

Responda APENAS em JSON válido:
{"porP":{"P1":{"itens":[{"indicacao":"","origem":"critério, feedback, coerência ou alerta","status":"corrigido","evidencia":""}],"melhorias_extras":[""],"resumo":"uma frase"}},"sintese":"um parágrafo sobre como o estudante respondeu às indicações ao longo do portfólio"}`;
}
function limparCorrecoes(r = {}) {
  const t = (v) => semTravessao(String(v || '').trim());
  const porP = {};
  for (const id of ORDEM_P) {
    const x = (r.porP || {})[id]; if (!x) continue;
    const itens = (Array.isArray(x.itens) ? x.itens : []).map((i) => {
      const st = String(i.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      return { indicacao: t(i.indicacao), origem: t(i.origem), status: STATUS_CORRECAO.includes(st) ? st : 'nao_verificavel', evidencia: t(i.evidencia) };
    }).filter((i) => i.indicacao);
    const conta = Object.fromEntries(STATUS_CORRECAO.map((s) => [s, itens.filter((i) => i.status === s).length]));
    const verificaveis = itens.length - conta.nao_verificavel - conta.nova_versao;
    porP[id] = { itens, melhorias_extras: (Array.isArray(x.melhorias_extras) ? x.melhorias_extras : []).map(t).filter(Boolean), resumo: t(x.resumo), conta,
      taxa: verificaveis ? Math.round(((conta.corrigido + conta.parcial * 0.5) / verificaveis) * 100) : null };
  }
  const todos = Object.values(porP).flatMap((x) => x.itens);
  const conta = Object.fromEntries(STATUS_CORRECAO.map((s) => [s, todos.filter((i) => i.status === s).length]));
  const verif = todos.length - conta.nao_verificavel - conta.nova_versao;
  return { porP, sintese: t(r.sintese), conta, taxa: verif ? Math.round(((conta.corrigido + conta.parcial * 0.5) / verif) * 100) : null };
}

module.exports = { montarPromptCorrecoes, limparCorrecoes, STATUS_CORRECAO, ANGULOS, montarPromptDossie, montarPromptTurma, limparDossie, limparTurma, VERIFICACOES, blocoEntrega };
