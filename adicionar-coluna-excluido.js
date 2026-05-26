const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar ao banco de dados
const dbPath = path.join(__dirname, 'peso.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Adicionando coluna "excluido" na tabela pesagens...');

db.run('ALTER TABLE pesagens ADD COLUMN excluido INTEGER DEFAULT 0', function(err) {
    if (err) {
        // Se o erro for porque a coluna já existe, não é um problema
        if (err.message.includes('duplicate column name')) {
            console.log('✅ Coluna "excluido" já existe no banco de dados.');
        } else {
            console.error('❌ Erro ao adicionar coluna:', err.message);
            process.exit(1);
        }
    } else {
        console.log('✅ Coluna "excluido" adicionada com sucesso!');
    }
    
    db.close((err) => {
        if (err) {
            console.error('❌ Erro ao fechar banco de dados:', err.message);
        } else {
            console.log('✅ Banco de dados fechado.');
        }
        process.exit(0);
    });
});
