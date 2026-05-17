// Script para inicializar banco de dados (SQLite ou PostgreSQL)
// Uso: npm run init-db

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const usePostgres = process.env.DATABASE_URL;

async function initPostgreSQL() {
  console.log('🐘 Inicializando PostgreSQL...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    // Criar tabela usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        codigo_recuperacao TEXT,
        codigo_expiracao TIMESTAMP
      )
    `);
    console.log('✅ Tabela "usuarios" criada');
    
    // Criar tabela pesagens
    await client.query(`
      CREATE TABLE IF NOT EXISTS pesagens (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        peso REAL NOT NULL,
        data_pesagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        excluido INTEGER DEFAULT 0,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);
    console.log('✅ Tabela "pesagens" criada');
    
    // Criar índices
    await client.query('CREATE INDEX IF NOT EXISTS idx_pesagens_usuario_id ON pesagens(usuario_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pesagens_data ON pesagens(data_pesagem)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pesagens_excluido ON pesagens(excluido)');
    console.log('✅ Índices criados');
    
    // Listar tabelas
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log('\n📊 Tabelas no banco:');
    result.rows.forEach(row => console.log(`   - ${row.tablename}`));
    
    // Contar registros
    const countUsuarios = await client.query('SELECT COUNT(*) as total FROM usuarios');
    const countPesagens = await client.query('SELECT COUNT(*) as total FROM pesagens WHERE excluido = 0');
    
    console.log('\n📈 Dados:');
    console.log(`   - Usuários: ${countUsuarios.rows[0].total}`);
    console.log(`   - Pesagens: ${countPesagens.rows[0].total}`);
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 PostgreSQL inicializado com sucesso!');
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

function initSQLite() {
  console.log('📁 Inicializando SQLite...');
  
  const dbPath = path.join(__dirname, '..', 'peso.db');
  const db = new sqlite3.Database(dbPath);
  
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        codigo_recuperacao TEXT,
        codigo_expiracao DATETIME
      )
    `);
    console.log('✅ Tabela "usuarios" criada');
    
    db.run(`
      CREATE TABLE IF NOT EXISTS pesagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        peso REAL NOT NULL,
        data_pesagem DATETIME DEFAULT CURRENT_TIMESTAMP,
        excluido INTEGER DEFAULT 0,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);
    console.log('✅ Tabela "pesagens" criada');
    
    db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
      console.log('\n📊 Tabelas no banco:');
      rows.forEach(row => console.log(`   - ${row.name}`));
      
      db.close();
      console.log('\n🎉 SQLite inicializado com sucesso!');
    });
  });
}

// Executar
if (usePostgres) {
  initPostgreSQL();
} else {
  initSQLite();
}
