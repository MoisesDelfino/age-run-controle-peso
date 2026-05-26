// Script de restauração de backup
// Restaura dados de um arquivo JSON de backup

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const backupDir = path.join(__dirname, '..', 'backups');

async function restoreDatabase(backupFile = 'backup-latest.json') {
  console.log('🔄 Iniciando restauração do banco de dados...');
  
  const filepath = path.join(backupDir, backupFile);
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Arquivo de backup não encontrado: ${backupFile}`);
    console.log('\n📋 Backups disponíveis:');
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
    files.forEach(f => console.log(`   - ${f}`));
    process.exit(1);
  }
  
  const backup = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  console.log(`📅 Backup de: ${backup.date}`);
  console.log(`📊 Usuários: ${backup.stats.total_usuarios}`);
  console.log(`📊 Pesagens: ${backup.stats.total_pesagens}`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? {
      rejectUnauthorized: false
    } : false
  });
  
  try {
    const client = await pool.connect();
    
    // Perguntar confirmação (em produção, adicionar prompt)
    console.log('\n⚠️  ATENÇÃO: Esta operação irá:');
    console.log('   1. Limpar dados existentes');
    console.log('   2. Restaurar dados do backup');
    console.log('\n   Pressione Ctrl+C para cancelar ou aguarde 5 segundos...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Desabilitar foreign keys temporariamente
    await client.query('SET session_replication_role = replica;');
    
    // Limpar tabelas
    console.log('🗑️  Limpando tabelas...');
    await client.query('DELETE FROM pesagens');
    await client.query('DELETE FROM usuarios');
    
    // Resetar sequences
    await client.query('ALTER SEQUENCE usuarios_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE pesagens_id_seq RESTART WITH 1');
    
    // Restaurar usuários
    console.log('👥 Restaurando usuários...');
    for (const usuario of backup.tables.usuarios) {
      await client.query(
        `INSERT INTO usuarios (id, nome, email, senha, data_cadastro, codigo_recuperacao, codigo_expiracao) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          usuario.id,
          usuario.nome,
          usuario.email,
          usuario.senha,
          usuario.data_cadastro,
          usuario.codigo_recuperacao,
          usuario.codigo_expiracao
        ]
      );
    }
    console.log(`✅ ${backup.tables.usuarios.length} usuários restaurados`);
    
    // Restaurar pesagens (usar completo para manter histórico)
    console.log('📊 Restaurando pesagens...');
    const pesagensParaRestaurar = backup.tables.pesagens_completo || backup.tables.pesagens;
    for (const pesagem of pesagensParaRestaurar) {
      await client.query(
        `INSERT INTO pesagens (id, usuario_id, peso, data_pesagem, excluido) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          pesagem.id,
          pesagem.usuario_id,
          pesagem.peso,
          pesagem.data_pesagem,
          pesagem.excluido || 0
        ]
      );
    }
    console.log(`✅ ${pesagensParaRestaurar.length} pesagens restauradas`);
    
    // Ajustar sequences para próximos IDs
    const maxUsuarioId = Math.max(...backup.tables.usuarios.map(u => u.id));
    const maxPesagemId = Math.max(...pesagensParaRestaurar.map(p => p.id));
    
    await client.query(`ALTER SEQUENCE usuarios_id_seq RESTART WITH ${maxUsuarioId + 1}`);
    await client.query(`ALTER SEQUENCE pesagens_id_seq RESTART WITH ${maxPesagemId + 1}`);
    
    // Reabilitar foreign keys
    await client.query('SET session_replication_role = DEFAULT;');
    
    // Verificar
    const checkUsuarios = await client.query('SELECT COUNT(*) FROM usuarios');
    const checkPesagens = await client.query('SELECT COUNT(*) FROM pesagens WHERE excluido = 0');
    
    console.log('\n✅ Restauração concluída!');
    console.log(`📊 Usuários: ${checkUsuarios.rows[0].count}`);
    console.log(`📊 Pesagens: ${checkPesagens.rows[0].count}`);
    
    client.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Erro ao restaurar backup:', err.message);
    process.exit(1);
  }
}

// Executar
const backupFile = process.argv[2] || 'backup-latest.json';
restoreDatabase(backupFile);
