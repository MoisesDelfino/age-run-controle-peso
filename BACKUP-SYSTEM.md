# 🔒 Sistema de Backup Automático

## 🎯 Proteção em 4 Camadas

### 1️⃣ **Banco PostgreSQL (Principal)**
- ✅ Dados persistentes no Render
- ✅ Nunca são apagados em deploys
- ✅ Proteção contra falhas de hardware

### 2️⃣ **Backup JSON (Diário)**
- ✅ Exportação completa para JSON
- ✅ Versionado no Git
- ✅ Fácil restauração

### 3️⃣ **Histórico Git (Permanente)**
- ✅ Todos os backups commitados
- ✅ Recuperação de qualquer ponto no tempo
- ✅ Auditoria completa

### 4️⃣ **Backup Manual (Sob demanda)**
- ✅ Executar quando precisar
- ✅ Antes de operações críticas

---

## 🚀 Como Usar

### Fazer Backup Manual

```bash
npm run backup
```

**Resultado:**
- Cria `backups/backup-YYYY-MM-DD-HH-MM.json`
- Atualiza `backups/backup-latest.json`
- Pronto para commit no Git

---

### Restaurar Backup

```bash
# Restaurar último backup
npm run restore

# Restaurar backup específico
npm run restore backup-2026-05-16-10-30.json
```

**⚠️ ATENÇÃO:** Isso irá **substituir todos os dados** atuais!

---

### Backup Automático com Git

```bash
npm run auto-backup
```

**Faz automaticamente:**
1. ✅ Backup completo
2. ✅ `git add backups/`
3. ✅ `git commit` com timestamp
4. ✅ Limpa backups antigos (mantém últimos 30)

---

## ⏰ Configurar Backup Automático no Render

### Opção 1: Cron Job (Render Paid)

Se tiver plano pago do Render:

1. Criar **Cron Job** no Dashboard
2. Schedule: `0 2 * * *` (2h da manhã, diariamente)
3. Command: `npm run auto-backup && git push`

### Opção 2: GitHub Actions (GRÁTIS!) ⭐

Crie `.github/workflows/backup.yml`:

```yaml
name: Backup Diário

on:
  schedule:
    - cron: '0 2 * * *'  # 2h da manhã (UTC)
  workflow_dispatch:      # Permite executar manualmente

jobs:
  backup:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Instalar dependências
        run: npm install
      
      - name: Executar backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npm run backup
      
      - name: Commit e Push
        run: |
          git config user.name "Backup Bot"
          git config user.email "backup@agerun.com"
          git add backups/
          git commit -m "Backup automático: $(date)" || echo "Nenhuma mudança"
          git push
```

**Configurar no GitHub:**
1. Repositório → Settings → Secrets → Actions
2. Adicionar secret: `DATABASE_URL` com a URL do PostgreSQL
3. Pronto! Backup diário automático **GRÁTIS** 🎉

### Opção 3: Script Local Agendado

No seu computador (Linux/Mac):

```bash
# Editar crontab
crontab -e

# Adicionar linha:
0 2 * * * cd /caminho/para/controle-peso-online && npm run auto-backup && git push
```

---

## 📊 O que é Salvo no Backup?

```json
{
  "timestamp": "2026-05-16T12:30:00.000Z",
  "date": "16/05/2026, 09:30:00",
  "version": "1.0",
  "tables": {
    "usuarios": [...],           // Todos os usuários
    "pesagens": [...],           // Pesagens ativas
    "pesagens_completo": [...]   // Incluindo excluídas
  },
  "stats": {
    "total_usuarios": 25,
    "total_pesagens": 150,
    "total_pesagens_completo": 152
  }
}
```

---

## 🆘 Recuperação de Desastre

### Cenário 1: Perda de Dados no PostgreSQL

```bash
npm run restore
```

### Cenário 2: Precisa voltar a backup antigo

```bash
# Ver backups disponíveis
ls -lh backups/

# Restaurar específico
npm run restore backup-2026-05-10-02-00.json
```

### Cenário 3: Dados corrompidos

```bash
# 1. Fazer backup atual (por precaução)
npm run backup

# 2. Restaurar backup anterior
npm run restore backup-YYYY-MM-DD-HH-MM.json
```

---

## 📝 Boas Práticas

### ✅ FAZER

- ✅ Backup manual **antes de cada deploy importante**
- ✅ Testar restauração periodicamente (1x/mês)
- ✅ Manter backups no Git (histórico completo)
- ✅ Configurar GitHub Actions (backup automático grátis)

### ❌ EVITAR

- ❌ Confiar apenas em um método de backup
- ❌ Nunca testar a restauração
- ❌ Deletar backups antigos manualmente (script já faz isso)

---

## 🔍 Verificar Integridade

```bash
# Fazer backup
npm run backup

# Verificar arquivo
cat backups/backup-latest.json | jq '.stats'

# Output esperado:
# {
#   "total_usuarios": 25,
#   "total_pesagens": 150,
#   "total_pesagens_completo": 152
# }
```

---

## 💡 Extras

### Baixar Backup do Servidor

```bash
# Via Render Dashboard: Shell → Download backups/backup-latest.json
```

### Backup para Nuvem (Opcional)

Adicionar ao script `auto-backup.js`:
- Upload para Google Drive
- Upload para Dropbox
- Enviar por e-mail

---

## 🎯 Resumo

**Com este sistema:**

✅ **PostgreSQL** = Dados principais (persistentes)  
✅ **JSON + Git** = Backup versionado (recuperável)  
✅ **GitHub Actions** = Automação grátis (diária)  
✅ **Script manual** = Controle total (sob demanda)

**Resultado:** 🔒 **Seus dados estão 100% seguros!**

---

**Próximo passo:** Configure o GitHub Actions para backup automático gratuito! 🚀
