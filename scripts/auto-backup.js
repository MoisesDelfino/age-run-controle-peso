// Sistema de backup automático com versionamento Git
// Executa backup e faz commit automático

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { backupDatabase } = require('./backup-database');
const fs = require('fs');
const path = require('path');

async function autoBackup() {
  console.log('🤖 Sistema de backup automático iniciado');
  console.log('⏰ ' + new Date().toLocaleString('pt-BR'));
  console.log('');
  
  try {
    // 1. Criar backup
    const backupFile = await backupDatabase();
    console.log('');
    
    // 2. Adicionar ao Git
    console.log('📝 Versionando backup no Git...');
    
    // Garantir que diretório backups existe no .gitignore (ou não, para versionar)
    // Vamos versionar os backups para ter histórico
    
    await execPromise('git add backups/');
    console.log('✅ Arquivos adicionados ao Git');
    
    // 3. Commit
    const commitMessage = `Backup automático: ${new Date().toLocaleString('pt-BR')}`;
    try {
      await execPromise(`git commit -m "${commitMessage}"`);
      console.log('✅ Commit criado');
      
      // 4. Push (opcional - comentar se não quiser push automático)
      // await execPromise('git push');
      // console.log('✅ Push realizado');
      
    } catch (err) {
      if (err.message.includes('nothing to commit')) {
        console.log('ℹ️  Nenhuma mudança para commitar (backup idêntico ao anterior)');
      } else {
        throw err;
      }
    }
    
    // 5. Limpar backups antigos (manter últimos 30 dias)
    console.log('');
    console.log('🗑️  Limpando backups antigos...');
    
    const backupDir = path.join(__dirname, '..', 'backups');
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json') && f !== 'backup-latest.json')
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    // Manter últimos 30 backups
    const toDelete = files.slice(30);
    toDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`   Removido: ${file.name}`);
    });
    
    if (toDelete.length === 0) {
      console.log('   Nenhum backup antigo para remover');
    } else {
      console.log(`✅ ${toDelete.length} backup(s) antigo(s) removido(s)`);
    }
    
    console.log('');
    console.log('✅ Backup automático concluído com sucesso!');
    console.log(`📊 Total de backups mantidos: ${Math.min(files.length, 30) + 1} (+ latest)`);
    
  } catch (err) {
    console.error('❌ Erro no backup automático:', err.message);
    process.exit(1);
  }
}

autoBackup();
