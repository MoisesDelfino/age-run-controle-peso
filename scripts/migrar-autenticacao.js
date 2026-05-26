const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Conectar ao banco
const dbPath = path.join(__dirname, '..', 'peso.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Migrando banco de dados para novo formato...\n');

async function migrarDados() {
    try {
        // 1. Backup da tabela antiga
        console.log('📦 Criando backup da tabela usuarios antiga...');
        await executarQuery('CREATE TABLE IF NOT EXISTS usuarios_backup AS SELECT * FROM usuarios');
        
        // 2. Criar nova tabela usuarios
        console.log('🔨 Criando nova estrutura de usuarios...');
        await executarQuery('DROP TABLE IF EXISTS usuarios');
        await executarQuery(`
            CREATE TABLE usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                senha TEXT NOT NULL,
                data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 3. Buscar usuários do backup
        const usuariosAntigos = await buscarTodos('SELECT * FROM usuarios_backup');
        
        console.log(`\n👥 Encontrados ${usuariosAntigos.length} usuários para migrar...\n`);
        
        // 4. Migrar cada usuário
        for (const usuario of usuariosAntigos) {
            const email = `${usuario.nome.toLowerCase().replace(/\s+/g, '.')}@agerun.com`;
            const senhaTemp = 'age123'; // Senha padrão temporária
            const senhaHash = await bcrypt.hash(senhaTemp, 10);
            
            try {
                await executarQuery(
                    'INSERT INTO usuarios (id, nome, email, senha, data_cadastro) VALUES (?, ?, ?, ?, ?)',
                    [usuario.id, usuario.nome, email, senhaHash, usuario.data_cadastro]
                );
                console.log(`✅ ${usuario.nome} - E-mail: ${email} - Senha: ${senhaTemp}`);
            } catch (error) {
                console.log(`❌ Erro ao migrar ${usuario.nome}: ${error.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('\n✅ Migração concluída com sucesso!');
        console.log('\n📧 E-mails gerados automaticamente:');
        console.log('   Formato: nome.sobrenome@agerun.com');
        console.log('\n🔑 Senha padrão para TODOS os usuários: age123');
        console.log('\n⚠️  IMPORTANTE: Os usuários devem trocar a senha no primeiro acesso!');
        console.log('\n🚀 Reinicie o servidor com: npm start');
        console.log('🌐 Acesse: http://localhost:3000\n');
        
    } catch (error) {
        console.error('\n❌ Erro na migração:', error);
    } finally {
        db.close();
    }
}

function executarQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function buscarTodos(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

migrarDados();
