const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'peso.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Adicionar colunas de bioimpedância na tabela pesagens
  const columns = [
    'gordura_percentual REAL DEFAULT NULL',
    'massa_muscular_percentual REAL DEFAULT NULL',
    'agua_percentual REAL DEFAULT NULL',
    'massa_ossea REAL DEFAULT NULL',
    'metabolismo_basal INTEGER DEFAULT NULL',
    'idade_metabolica INTEGER DEFAULT NULL',
    'gordura_visceral INTEGER DEFAULT NULL'
  ];

  columns.forEach((column) => {
    const columnName = column.split(' ')[0];
    db.run(`ALTER TABLE pesagens ADD COLUMN ${column}`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`✅ Coluna ${columnName} já existe`);
        } else {
          console.error(`❌ Erro ao adicionar coluna ${columnName}:`, err.message);
        }
      } else {
        console.log(`✅ Coluna ${columnName} adicionada com sucesso`);
      }
    });
  });
});

setTimeout(() => {
  db.close(() => {
    console.log('✅ Migração concluída');
    process.exit(0);
  });
}, 1000);
