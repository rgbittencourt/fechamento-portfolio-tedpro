// Estado do Fechamento (turmas abertas, vínculos manuais, Padlet, dossiês e relatórios gerados).
// Fica no Postgres (Neon) em produção, num arquivo local nos testes, com cópia no GitHub.
const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const githubBackup = require('./github-backup');

const ARQUIVO = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'fechamento.json');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const TABELA = 'fechamento_app_state';
let pronta = false;
let fila = Promise.resolve();

async function preparar() {
  if (!pool || pronta) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS ${TABELA} (id integer PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  pronta = true;
}
const vazio = () => ({ version: 1, turmas: {} });

async function ler() {
  if (pool) {
    await preparar();
    const r = await pool.query(`SELECT payload FROM ${TABELA} WHERE id = 1`);
    return r.rows[0]?.payload || vazio();
  }
  try { return JSON.parse(await fs.readFile(ARQUIVO, 'utf8')); } catch { return vazio(); }
}
async function gravar(base) {
  if (pool) {
    await preparar();
    await pool.query(`INSERT INTO ${TABELA} (id, payload, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`, [JSON.stringify(base)]);
  } else {
    await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
    await fs.writeFile(`${ARQUIVO}.tmp`, JSON.stringify(base, null, 2));
    await fs.rename(`${ARQUIVO}.tmp`, ARQUIVO);
  }
  if (githubBackup.status().configurado) githubBackup.sincronizar(base).catch((e) => console.error('Backup GitHub não realizado:', e.message));
}
// Altera o estado de uma turma em série (evita gravações simultâneas se sobrepondo).
function alterarTurma(chave, fn) {
  const tarefa = fila.catch(() => {}).then(async () => {
    const base = await ler();
    base.turmas[chave] = base.turmas[chave] || { mapa: {}, vinculos: {}, padlet: {}, dossies: {}, relatorio: null };
    const resultado = await fn(base.turmas[chave], base);
    await gravar(base);
    return resultado;
  });
  fila = tarefa;
  return tarefa;
}
async function excluirTurma(chave) {
  const tarefa = fila.catch(() => {}).then(async () => { const base = await ler(); delete base.turmas[chave]; await gravar(base); });
  fila = tarefa; return tarefa;
}
async function lerTurma(chave) { const base = await ler(); return base.turmas[chave] || null; }
async function listar() { const base = await ler(); return Object.entries(base.turmas).map(([chave, t]) => ({ chave, nome: t.nome || chave, mapa: t.mapa, atualizadaEm: t.atualizadaEm || '' })); }

module.exports = { excluirTurma, lerTurma, alterarTurma, listar, statusBackup: () => githubBackup.status(), usaPostgres: () => Boolean(pool) };
