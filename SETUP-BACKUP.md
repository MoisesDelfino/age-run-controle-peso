# ⚡ Configuração Rápida - Backup Automático

## 🎯 1 minuto para configurar backup GRÁTIS!

### Passo 1: Adicionar DATABASE_URL ao GitHub

1. Acesse: https://github.com/MoisesDelfino/age-run-controle-peso/settings/secrets/actions

2. Clique em **"New repository secret"**

3. Preencha:
   - **Name:** `DATABASE_URL`
   - **Secret:** Cole a **Internal Database URL** do Render
   
4. Clique em **"Add secret"**

✅ Pronto! O backup automático já está configurado!

---

### Passo 2: Testar (Opcional)

1. Vá para: https://github.com/MoisesDelfino/age-run-controle-peso/actions

2. Clique em **"🔒 Backup Automático Diário"**

3. Clique em **"Run workflow"** → **"Run workflow"**

4. Aguarde ~2 minutos

5. ✅ Você verá um novo commit com o backup!

---

### Passo 3: Verificar

Após o primeiro backup, você verá:
- Novo arquivo: `backups/backup-2026-05-16-02-00.json`
- Atualizado: `backups/backup-latest.json`
- Commit: "🔒 Backup automático: 16/05/2026 02:00"

---

## ⏰ Quando roda?

**Todo dia às 2h da manhã (UTC) = 23h (Brasília)**

Você também pode executar manualmente quando quiser!

---

## 📊 O que é salvo?

✅ Todos os usuários (nome, email, senha hash)  
✅ Todas as pesagens (peso, data)  
✅ Histórico completo (incluindo excluídas)  
✅ Estatísticas e timestamps

---

## 🆘 Como restaurar?

```bash
# Baixar backup do GitHub
git pull

# Restaurar último backup
npm run restore

# Ou restaurar backup específico
npm run restore backup-2026-05-16-02-00.json
```

---

## 🎉 Benefícios

✅ **100% Grátis** (GitHub Actions)  
✅ **Automático** (sem esforço manual)  
✅ **Versionado** (histórico completo no Git)  
✅ **Recuperável** (restauração em 1 comando)  
✅ **Auditável** (ver todos os backups no repositório)

---

**Próximo passo:** Adicione o secret `DATABASE_URL` no GitHub agora! 🚀
