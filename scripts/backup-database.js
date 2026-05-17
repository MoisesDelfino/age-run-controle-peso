// Script de backup automático do banco de dados
// Exporta dados para JSON com timestamp

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDir = path.join(__dirname, '..', 'backups');

async function backupDatabase() {
  console.log('📦 Iniciando backup do banco de dados...');
  
  // Criar diretório de backups se não existir
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('📁 Diretório de backups criado');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? {
      rejectUnauthorized: false
    } : false
  });
  
  try {
    const client = await pool.connect();
    
    // Backup de usuários
    const usuarios = await client.query('SELECT * FROM usuarios ORDER BY id');
    console.log(`✅ ${usuarios.rows.length} usuários exportados`);
    
    // Backup de pesagens (não excluídas)
    const pesagens = await client.query('SELECT * FROM pesagens WHERE excluido = 0 ORDER BY data_pesagem DESC');
    console.log(`✅ ${pesagens.rows.length} pesagens exportadas`);
    
    // Backup de todas as pesagens (incluindo excluídas, para histórico completo)
    const pesagensCompletas = await client.query('SELECT * FROM pesagens ORDER BY id');
    console.log(`✅ ${pesagensCompletas.rows.length} pesagens totais (com excluídas)`);
    
    // Criar objeto de backup
    const backup = {
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleString('pt-BR'),
      version: '1.0',
      tables: {
        usuarios: usuarios.rows,
        pesagens: pesagens.rows,
        pesagens_completo: pesagensCompletas.rows
      },
      stats: {
        total_usuarios: usuarios.rows.length,
        total_pesagens: pesagens.rows.length,
        total_pesagens_completo: pesagensCompletas.rows.length
      }
    };
    
    // Salvar com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    console.log(`💾 Backup salvo: ${filename}`);
    
    // Salvar também como "latest" para fácil acesso
    const latestPath = path.join(backupDir, 'backup-latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2));
    console.log('💾 Backup "latest" atualizado');
    
    // Estatísticas
    const fileSize = (fs.statSync(filepath).size / 1024).toFixed(2);
    console.log(`📊 Tamanho: ${fileSize} KB`);
    
    client.release();
    await pool.end();
    
    console.log('✅ Backup concluído com sucesso!');
    return filepath;
    
  } catch (err) {
    console.error('❌ Erro ao fazer backup:', err.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };
