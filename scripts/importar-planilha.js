const db = require('../database');

// Dados da planilha (janeiro 2025 e atualizado)
const dadosPlanilha = [
    { nome: "Luiz Freitas", pesoInicial: 126.40, pesoAtual: 104.10 },
    { nome: "Ederson", pesoInicial: 88.00, pesoAtual: 67.45 },
    { nome: "Moises", pesoInicial: 110.00, pesoAtual: 92.50 },
    { nome: "Marcelo de Souza", pesoInicial: 99.80, pesoAtual: 84.30 },
    { nome: "Gian", pesoInicial: 79.80, pesoAtual: 69.10 },
    { nome: "Guilherme C.", pesoInicial: 81.00, pesoAtual: 70.60 },
    { nome: "Lucas Pacheco", pesoInicial: 81.20, pesoAtual: 71.60 },
    { nome: "Victor", pesoInicial: 76.00, pesoAtual: 66.85 },
    { nome: "Jean Henrique", pesoInicial: 90.00, pesoAtual: 82.30 },
    { nome: "João Ronchi", pesoInicial: 82.00, pesoAtual: 76.80 },
    { nome: "Lucas Jorge", pesoInicial: 78.40, pesoAtual: 73.80 },
    { nome: "Guilherme J", pesoInicial: 94.05, pesoAtual: 90.45 },
    { nome: "Richard", pesoInicial: 71.10, pesoAtual: 67.80 },
    { nome: "Luizão", pesoInicial: 128.90, pesoAtual: 125.80 },
    { nome: "Guilherme P", pesoInicial: 87.00, pesoAtual: 84.00 },
    { nome: "Well", pesoInicial: 63.60, pesoAtual: 61.00 },
    { nome: "Leirson", pesoInicial: 76.50, pesoAtual: 74.00 },
    { nome: "Fabricio", pesoInicial: 75.20, pesoAtual: 72.90 },
    { nome: "Daniel", pesoInicial: 70.50, pesoAtual: 68.50 },
    { nome: "Andrei", pesoInicial: 69, pesoAtual: 68 },
    { nome: "Luan", pesoInicial: 81.7, pesoAtual: 80.9 },
    { nome: "Filipe", pesoInicial: 67.9, pesoAtual: 70 },
    { nome: "Joey", pesoInicial: 79.5, pesoAtual: 94.2 }
];

console.log('📊 Importando dados da planilha...\n');

// Função para inserir dados
async function importarDados() {
    let sucessos = 0;
    let erros = 0;

    for (const pessoa of dadosPlanilha) {
        try {
            // Inserir usuário
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO usuarios (nome) VALUES (?)',
                    [pessoa.nome],
                    function(err) {
                        if (err) {
                            // Se usuário já existe, buscar ID
                            db.get(
                                'SELECT id FROM usuarios WHERE nome = ?',
                                [pessoa.nome],
                                (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row.id);
                                }
                            );
                        } else {
                            resolve(this.lastID);
                        }
                    }
                );
            }).then(usuarioId => {
                // Inserir pesagem inicial (janeiro 2025)
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO pesagens (usuario_id, peso, data_pesagem) 
                         VALUES (?, ?, datetime('2025-01-01 08:00:00'))`,
                        [usuarioId, pessoa.pesoInicial],
                        function(err) {
                            if (err) reject(err);
                            else resolve(usuarioId);
                        }
                    );
                });
            }).then(usuarioId => {
                // Inserir pesagem atual (maio 2026)
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO pesagens (usuario_id, peso, data_pesagem) 
                         VALUES (?, ?, datetime('2026-05-16 08:00:00'))`,
                        [usuarioId, pessoa.pesoAtual],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            });

            console.log(`✅ ${pessoa.nome}: ${pessoa.pesoInicial} kg → ${pessoa.pesoAtual} kg`);
            sucessos++;
        } catch (error) {
            console.error(`❌ Erro ao importar ${pessoa.nome}:`, error.message);
            erros++;
        }
    }

    // Aguardar processamento
    setTimeout(() => {
        console.log('\n' + '='.repeat(50));
        console.log(`\n📊 Importação concluída!`);
        console.log(`   ✅ Sucessos: ${sucessos}`);
        console.log(`   ❌ Erros: ${erros}`);
        console.log('\n🚀 Inicie o servidor com: npm start');
        console.log('🌐 Acesse: http://localhost:3000\n');
        process.exit(0);
    }, 2000);
}

importarDados();
