// Script de restauração de backup para SQLite (desenvolvimento local)
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '..', 'backups');
const dbPath = path.join(__dirname, '..', 'database.sqlite');

async function restoreDatabase(backupFile = 'backup-latest.json') {
  console.log('🔄 Iniciando restauração no SQLite local...');
  
  const filepath = path.join(backupDir, backupFile);
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Arquivo de backup não encontrado: ${backupFile}`);
    process.exit(1);
  }
  
  const backup = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  console.log(`📅 Backup de: ${backup.date}`);
  console.log(`📊 Usuários: ${backup.stats.total_usuarios}`);
  console.log(`📊 Pesagens: ${backup.stats.total_pesagens}`);
  
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('\n🔧 Criando estrutura do banco (se necessário)...');
      
      // Criar tabelas se não existirem
      db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        codigo_recuperacao TEXT,
        codigo_expiracao DATETIME
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS pesagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        peso REAL NOT NULL,
        data_pesagem DATETIME NOT NULL,
        excluido INTEGER DEFAULT 0,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`);
      
      console.log('⚠️  ATENÇÃO: Limpando dados locais...');
      
      // Desabilitar foreign keys
      db.run('PRAGMA foreign_keys = OFF');
      
      // Limpar tabelas
      console.log('🗑️  Limpando tabelas...');
      db.run('DELETE FROM pesagens');
      db.run('DELETE FROM usuarios');
      
      // Resetar autoincrement
      db.run('DELETE FROM sqlite_sequence WHERE name="usuarios"');
      db.run('DELETE FROM sqlite_sequence WHERE name="pesagens"');
      
      // Restaurar usuários
      console.log('👥 Restaurando usuários...');
      const stmtUsuario = db.prepare(
        'INSERT INTO usuarios (id, nome, email, senha, data_cadastro, codigo_recuperacao, codigo_expiracao) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      
      backup.tables.usuarios.forEach(usuario => {
        stmtUsuario.run(
          usuario.id,
          usuario.nome,
          usuario.email,
          usuario.senha,
          usuario.data_cadastro,
          usuario.codigo_recuperacao,
          usuario.codigo_expiracao
        );
      });
      stmtUsuario.finalize();
      console.log(`✅ ${backup.tables.usuarios.length} usuários restaurados`);
      
      // Restaurar pesagens
      console.log('📊 Restaurando pesagens...');
      const pesagensParaRestaurar = backup.tables.pesagens_completo || backup.tables.pesagens;
      const stmtPesagem = db.prepare(
        'INSERT INTO pesagens (id, usuario_id, peso, data_pesagem, excluido) VALUES (?, ?, ?, ?, ?)'
      );
      
      pesagensParaRestaurar.forEach(pesagem => {
        stmtPesagem.run(
          pesagem.id,
          pesagem.usuario_id,
          pesagem.peso,
          pesagem.data_pesagem,
          pesagem.excluido || 0
        );
      });
      stmtPesagem.finalize();
      console.log(`✅ ${pesagensParaRestaurar.length} pesagens restauradas`);
      
      // Reabilitar foreign keys
      db.run('PRAGMA foreign_keys = ON', (err) => {
        db.close(() => {
          if (err) {
            console.error('❌ Erro:', err);
            reject(err);
          } else {
            console.log('\n✅ Restauração concluída com sucesso!');
            console.log('🔄 Reinicie o servidor para ver os dados atualizados');
            resolve();
          }
        });
      });
    });
  });
}

// Executar
const backupFile = process.argv[2] || 'backup-latest.json';
restoreDatabase(backupFile)
  .catch(err => {
    console.error('❌ Erro ao restaurar:', err);
    process.exit(1);
  });
