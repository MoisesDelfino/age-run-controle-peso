const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'peso.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Adicionar coluna altura na tabela usuarios
  db.run(`
    ALTER TABLE usuarios ADD COLUMN altura REAL DEFAULT NULL
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✅ Coluna altura já existe');
      } else {
        console.error('❌ Erro ao adicionar coluna altura:', err.message);
      }
    } else {
      console.log('✅ Coluna altura adicionada com sucesso');
    }
  });
});

db.close(() => {
  console.log('✅ Migração concluída');
  process.exit(0);
});
