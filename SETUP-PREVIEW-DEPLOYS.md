# ⚡ Configuração Rápida - Preview Deploys no Render

## 🎯 O que são Preview Deploys?

Preview Deploys criam **ambientes temporários** para cada branch, permitindo:
- ✅ Testar features antes de produção
- ✅ Manter produção estável
- ✅ Compartilhar versões com testers
- ✅ Rollback fácil se algo der errado

---

## 🚀 Passo a Passo (5 minutos)

### 1️⃣ **Push das Branches para GitHub**

```bash
cd "/home/moises-delfino/Área de trabalho/controle-peso-online"

# Fazer push de todas as branches
git push -u origin main
git push -u origin staging
git push -u origin develop
```

**Resultado:** Branches disponíveis no GitHub.

---

### 2️⃣ **Configurar Preview no Render**

1. **Acesse:** https://dashboard.render.com

2. **Selecione seu serviço:** `age-run-controle-peso`

3. **Vá em:** `Settings` (menu lateral)

4. **Encontre:** `Preview Environments` (rolar para baixo)

5. **Configure:**
   - **Enable Preview Environments:** ✅ ON
   - **Auto-Deploy:** ✅ Yes
   - **Branches to Preview:** 
     ```
     staging
     feature/*
     ```

6. **Save Changes**

**Pronto!** 🎉

---

### 3️⃣ **Testar o Sistema**

```bash
# Fazer uma mudança em staging
git checkout staging

# Criar arquivo de teste
echo "console.log('Preview test');" > test-preview.js

git add test-preview.js
git commit -m "test: preview deploy"
git push origin staging

# Aguardar 2-3 minutos
# Render irá criar uma URL preview automática
```

**URL Preview será algo como:**
- `https://age-run-staging.onrender.com`
- Ou: `https://age-run-pr-123.onrender.com`

---

## 📊 Estrutura Final

### **Ambientes Disponíveis:**

```
┌─────────────────────────────────────────────────┐
│ PRODUÇÃO (main)                                 │
│ URL: https://age-run.onrender.com              │
│ • Versão estável                                │
│ • Usuários finais                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ STAGING (staging)                               │
│ URL: https://age-run-staging.onrender.com      │
│ • Preview automático                            │
│ • Testes finais                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ DESENVOLVIMENTO (develop)                       │
│ URL: http://localhost:3001                      │
│ • Desenvolvimento local                         │
│ • Não faz deploy                                │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Simplificado

### **Dia a Dia:**

```bash
# 1. Desenvolver localmente (develop)
git checkout develop
# ... trabalhar ...
git add .
git commit -m "feat: nova feature"
git push origin develop

# 2. Testar em servidor (staging)
git checkout staging
git merge develop
git push origin staging
# → Acesse URL preview e teste

# 3. Aprovar para produção (main)
git checkout main
git merge staging
git push origin main
# → Deploy automático em produção
```

---

## 🎨 URLs de Cada Ambiente

Após configurar, você terá:

### **Produção (sempre ativa):**
```
https://age-run.onrender.com
```

### **Staging (preview):**
```
https://age-run-staging.onrender.com
```

### **Features (se criar branch feature/X):**
```
https://age-run-feature-x.onrender.com
```

---

## 🧪 Testar Agora

### **Criar feature de teste:**

```bash
# Criar branch de teste
git checkout develop
git checkout -b feature/test-preview

# Fazer mudança visível
echo "<h1>Preview Test - $(date)</h1>" > public/test.html

git add .
git commit -m "test: preview environment"
git push origin feature/test-preview

# Aguardar 2-3 minutos
# Render criará: https://age-run-feature-test-preview.onrender.com
```

**Verificar:**
1. Dashboard Render > Deploys
2. Deve aparecer deploy da branch `feature/test-preview`
3. Status: "Live" com URL preview

---

## 📧 Notificações (Opcional)

Configure notificações para receber alertas:

### **No Render:**
1. **Settings** > **Notifications**
2. Adicionar:
   - Email
   - Slack (se usar)
   - Discord (se usar)
3. Escolher eventos:
   - ✅ Deploy Started
   - ✅ Deploy Succeeded
   - ✅ Deploy Failed

### **No GitHub:**
1. **Settings** > **Notifications**
2. **Watching** no repositório
3. Receber notificações de push/PR

---

## 🔐 Variáveis de Ambiente

Preview environments herdam variáveis da produção por padrão.

### **Para variáveis específicas de preview:**

```bash
# No Dashboard Render > Preview Environments
# Adicionar variáveis específicas:
PREVIEW_MODE=true
DEBUG_LEVEL=verbose
```

---

## 🆘 Solução de Problemas

### **Preview não está sendo criado:**

1. Verificar branches configuradas em Settings
2. Verificar se auto-deploy está habilitado
3. Ver logs: Render Dashboard > Logs

### **Preview falha no deploy:**

1. Verificar build command no render.yaml
2. Ver erro específico nos logs
3. Testar build localmente: `npm install && npm start`

### **URL preview não carrega:**

1. Aguardar 2-3 minutos (primeiro deploy é mais lento)
2. Verificar health check path: `/login`
3. Ver logs para erros de inicialização

---

## 📋 Checklist Final

Antes de usar em produção:

- [ ] Push das 3 branches para GitHub (main, staging, develop)
- [ ] Preview Environments habilitado no Render
- [ ] Testar push em staging (deve criar preview)
- [ ] Verificar URL preview funcionando
- [ ] Notificações configuradas (opcional)
- [ ] Backup de produção feito (sempre!)
- [ ] Time avisado sobre novo workflow

---

## 🎯 Próximos Passos

1. ✅ **Configurar agora** (5 min)
2. 📚 **Ler:** [WORKFLOW-GIT.md](WORKFLOW-GIT.md) (guia completo)
3. 🧪 **Testar:** Criar feature de teste e ver preview
4. 🚀 **Usar:** Desenvolver próxima feature usando o workflow

---

## 📞 Links Úteis

- **Dashboard Render:** https://dashboard.render.com
- **Repositório GitHub:** (seu repositório)
- **Documentação Render:** https://render.com/docs/preview-environments
- **Guia Completo:** [WORKFLOW-GIT.md](WORKFLOW-GIT.md)

---

**Status Atual:**
- ✅ Branches criadas (main, staging, develop)
- ✅ Documentação pronta
- ⏳ Aguardando: Push para GitHub + Config Render

**Próximo comando:**
```bash
git push -u origin main staging develop
```

---

**Criado em:** 20/05/2026  
**Setup time:** 5 minutos  
**Sistema:** Age Run - Controle de Peso
