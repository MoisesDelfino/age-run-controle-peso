const db = require('../database');

console.log('🔧 Inicializando banco de dados...');

// Aguardar um pouco para garantir que as tabelas foram criadas
setTimeout(() => {
    console.log('✅ Banco de dados inicializado!');
    console.log('📊 Tabelas: usuarios, pesagens');
    console.log('');
    console.log('Você pode agora iniciar o servidor com: npm start');
    process.exit(0);
}, 1000);
