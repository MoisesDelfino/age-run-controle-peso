const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar ao banco de dados
const dbPath = path.join(__dirname, 'peso.db');
const db = new sqlite3.Database(dbPath);

console.log('🗑️  Limpando todas as pesagens do banco de dados...');

db.run('DELETE FROM pesagens', function(err) {
    if (err) {
        console.error('❌ Erro ao limpar pesagens:', err.message);
        process.exit(1);
    }
    
    console.log(`✅ ${this.changes} pesagens foram removidas com sucesso!`);
    console.log('📊 O ranking agora será alimentado apenas com dados novos.');
    
    db.close((err) => {
        if (err) {
            console.error('❌ Erro ao fechar banco de dados:', err.message);
        } else {
            console.log('✅ Banco de dados fechado.');
        }
        process.exit(0);
    });
});
