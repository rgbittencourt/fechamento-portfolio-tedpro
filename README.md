# Fechamento do Portfólio · TEDPRO

Fechamento do portfólio da Especialização TEDPRO (IFSC): reúne as avaliações das **P1 a P6** de uma turma, cruza as entregas de cada estudante e gera o **dossiê de banca** (para o professor orientador e a banca) e o **relatório da turma**.

## Aplicativo publicado

- **App:** https://fechamento-portfolio-tedpro.onrender.com
- **Verificação do servidor:** https://fechamento-portfolio-tedpro.onrender.com/api/health

## Como funciona

1. **Abrir a turma.** Digite o nome (ex.: *Calabresa*). O app procura a turma nos repositórios de dados das seis Ps, mesmo que o nome varie um pouco entre eles, e você confere a escolha.
2. **Juntar os estudantes.** As entregas são ligadas pela matrícula; sem matrícula, pelo nome (com tolerância a acentos e nomes abreviados). Ligações por nome parecido aparecem para conferência, e é possível juntar ou separar à mão.
3. **Fatos calculados (sem IA, sempre iguais para os mesmos dados):** notas de P1 a P6 e comparação com a turma, tendência, desempenho por tema somando todas as Ps (radar), temas que persistiram fracos, que foram superados ou que caíram, semelhança do desafio e do público de cada P com a primeira entrega (deriva de foco), declaração de IA em cada P, orientador informado, links de cada produto e se o relato (P6) aponta para os mesmos produtos avaliados.
4. **Dossiê de banca (IA):** síntese, fio do desafio de P1 a P6, oito verificações cruzadas fixas (desafio mantido, público coerente, produtos que dialogam, relato fiel às entregas, resultados com evidência, feedback incorporado, IA transparente, promessa da P1 cumprida), pontos fortes, fragilidades, contradições entre as Ps, aprendizagem ao longo do curso, **3 a 5 perguntas para a banca** que cruzam as entregas (com o porquê e o que observar na resposta), sugestões para seguir adiante, pontos de atenção e parecer ao orientador.
5. **Relatório da turma:** entregas por P e onde os estudantes param, média por P, mapa de calor estudantes × Ps, desempenho por tema, temas persistentes e superados, critérios mais frágeis e mais fortes, correlações entre as Ps, deriva de desafios, uso de IA, alertas frequentes e, com IA, panorama, tendências, maiores acertos, maiores problemas, relações entre as Ps, estudantes que pedem atenção, destaques e recomendações.
6. **Padlet:** cada estudante tem um campo para o link do Padlet. A conferência mostra quais Ps estão postadas, se os links batem com os avaliados e se o desafio do Padlet é o mesmo da P1. Sem assinatura do Padlet, a leitura é feita pelo Claude (conector do Padlet) e enviada ao app em `POST /api/turmas/:turma/padlet-lote`.

Os dossiês e o relatório ficam salvos: com os mesmos dados, o app mostra o mesmo texto; quando uma avaliação muda, ele avisa que os dados mudaram.

## Dados lidos

Cada Avaliador guarda `dados/turmas.json` no seu repositório de dados:

| P | Repositório |
|---|---|
| P1 Descobrindo meu desafio | `avaliador-p1-definicao-desafio-dados` |
| P2 Roteiro e vídeo | `avaliador-p2-dados` |
| P3 Proposta formativa | `avaliador-p3-proposta-formativa-dados` |
| P4 Podcast | `avaliador-podcast-dados` |
| P5 Agente de IA | `avaliador-p5-agente-ia-dados` |
| P6 Relato de experiência | `avaliador-p6-relato-de-experiencia-dados` |

## Rodar localmente

```bash
npm install
node scripts/gerar-dados-teste.js /tmp/fech-dados   # turma fictícia "Calabresa"
DADOS_LOCAIS=/tmp/fech-dados npm start
npm test
```

## Variáveis de ambiente

Veja `.env.example`. Em produção: `APP_PASSWORD`, `DATABASE_URL` (Neon), `GITHUB_DATA_TOKEN` (leitura nos seis repositórios de dados e escrita no `fechamento-portfolio-tedpro-dados`) e ao menos uma chave de IA. Para o dossiê, recomenda-se um modelo mais forte (ex.: `ANTHROPIC_MODEL=claude-sonnet-5-5`).

## Privacidade

Os dossiês contêm notas e dados pessoais: ficam só no app com login e no repositório privado de backup.

Prof. Rogério Gonçalves Bittencourt · IFSC
