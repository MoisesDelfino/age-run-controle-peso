const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'peso.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Adicionando colunas para recuperação de senha...');

db.serialize(() => {
  // Adicionar coluna codigo_recuperacao
  db.run(`ALTER TABLE usuarios ADD COLUMN codigo_recuperacao TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  Coluna codigo_recuperacao já existe');
      } else {
        console.error('❌ Erro ao adicionar codigo_recuperacao:', err.message);
      }
    } else {
      console.log('✅ Coluna codigo_recuperacao adicionada');
    }
  });

  // Adicionar coluna codigo_expiracao
  db.run(`ALTER TABLE usuarios ADD COLUMN codigo_expiracao DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  Coluna codigo_expiracao já existe');
      } else {
        console.error('❌ Erro ao adicionar codigo_expiracao:', err.message);
      }
    } else {
      console.log('✅ Coluna codigo_expiracao adicionada');
    }
    
    db.close(() => {
      console.log('🎉 Migração concluída!');
    });
  });
});
