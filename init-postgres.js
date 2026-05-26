// Script para inicializar banco de dados PostgreSQL
// Uso: node init-postgres.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false
});

async function initDatabase() {
  console.log('🚀 Inicializando banco de dados PostgreSQL...');
  
  try {
    // Conectar
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
    console.log('✅ Tabela "usuarios" criada/verificada');
    
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
    console.log('✅ Tabela "pesagens" criada/verificada');
    
    // Criar índices
    await client.query('CREATE INDEX IF NOT EXISTS idx_pesagens_usuario_id ON pesagens(usuario_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pesagens_data ON pesagens(data_pesagem)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pesagens_excluido ON pesagens(excluido)');
    console.log('✅ Índices criados/verificados');
    
    // Listar tabelas
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log('\n📊 Tabelas no banco:');
    result.rows.forEach(row => {
      console.log(`   - ${row.tablename}`);
    });
    
    // Contar registros
    const countUsuarios = await client.query('SELECT COUNT(*) as total FROM usuarios');
    const countPesagens = await client.query('SELECT COUNT(*) as total FROM pesagens WHERE excluido = 0');
    
    console.log('\n📈 Dados:');
    console.log(`   - Usuários: ${countUsuarios.rows[0].total}`);
    console.log(`   - Pesagens: ${countPesagens.rows[0].total}`);
    
    client.release();
    console.log('\n🎉 Banco de dados inicializado com sucesso!');
    
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
    console.error('\n💡 Verifique se DATABASE_URL está configurada corretamente no .env');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
