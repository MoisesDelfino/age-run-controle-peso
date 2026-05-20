# 🌿 Workflow Git - Branches & Preview Deploys

## 📋 Estrutura de Branches

```
main (produção)          → https://age-run.onrender.com
  ↑
  │ (merge quando aprovado)
  │
staging (pré-produção)   → https://age-run-staging.onrender.com (preview)
  ↑
  │ (merge features)
  │
develop (desenvolvimento) → Local (porta 3001)
```

---

## 🎯 Propósito de Cada Branch

### **`main` - PRODUÇÃO** 🔴
- **Status:** ESTÁVEL e TESTADO
- **Deploy:** Automático no Render
- **URL:** https://age-run.onrender.com
- **Acesso:** Usuários finais
- **Proteção:** Nunca fazer commit direto, apenas merge de `staging`

### **`staging` - PRÉ-PRODUÇÃO** 🟡
- **Status:** Features completas aguardando aprovação
- **Deploy:** Preview automático no Render
- **URL:** https://age-run-pr-[número].onrender.com
- **Acesso:** Você + testers
- **Proteção:** Merge apenas de `develop`, depois testa antes de ir para `main`

### **`develop` - DESENVOLVIMENTO** 🟢
- **Status:** Features em desenvolvimento
- **Deploy:** Local apenas
- **URL:** http://localhost:3001
- **Acesso:** Desenvolvimento local
- **Liberdade:** Pode fazer commits diretos, experimentar

---

## 🔄 Fluxo de Trabalho Completo

### 1. **Desenvolver Nova Feature**

```bash
# Começar sempre do develop
git checkout develop
git pull origin develop

# Trabalhar normalmente
# ... editar arquivos ...

# Commit local
git add .
git commit -m "feat: nova funcionalidade X"

# Push para GitHub
git push origin develop
```

**Resultado:** Nada muda em produção, você testa localmente.

---

### 2. **Preparar para Preview (Testar em Servidor)**

```bash
# Feature pronta? Mover para staging
git checkout staging
git pull origin staging
git merge develop

# Resolver conflitos se houver
# ... resolver conflitos ...
git add .
git commit -m "chore: merge develop → staging"

# Push para GitHub (dispara preview deploy)
git push origin staging
```

**Resultado:** Render cria URL preview automática!
- Preview URL: `https://age-run-staging.onrender.com`
- Ou: `https://age-run-pr-123.onrender.com`

---

### 3. **Aprovar e Publicar (Ir para Produção)**

```bash
# Testou o preview e está tudo OK?
git checkout main
git pull origin main
git merge staging

# Criar tag de versão (opcional mas recomendado)
git tag -a v1.1.0 -m "Release: Análise Avançada Bioimpedância"

# Push para produção
git push origin main
git push origin --tags
```

**Resultado:** Deploy automático em produção!
- URL produção: `https://age-run.onrender.com`
- Usuários veem a nova versão em ~2 minutos

---

## 🚨 Cenários Práticos

### **Cenário 1: Bug Crítico em Produção**

```bash
# Hotfix direto na main (exceção à regra)
git checkout main
git pull origin main

# Criar branch de hotfix
git checkout -b hotfix/corrigir-bug-critico

# Corrigir bug
# ... editar arquivos ...

git add .
git commit -m "fix: corrige bug crítico no login"

# Merge direto na main (emergência)
git checkout main
git merge hotfix/corrigir-bug-critico
git push origin main

# Não esquecer de propagar para outras branches
git checkout staging
git merge main
git push origin staging

git checkout develop
git merge main
git push origin develop
```

---

### **Cenário 2: Testar Feature Isolada**

```bash
# Criar branch de feature
git checkout develop
git checkout -b feature/nova-dashboard

# Desenvolver
# ... trabalhar na feature ...

git add .
git commit -m "feat: adiciona nova dashboard"

# Push para testar no preview
git push origin feature/nova-dashboard

# No Render, configurar preview para branches feature/*
# URL: https://age-run-feature-nova-dashboard.onrender.com
```

---

### **Cenário 3: Reverter Deploy (Rollback)**

```bash
# Opção A: Reverter último commit
git checkout main
git revert HEAD
git push origin main

# Opção B: Voltar para commit específico
git checkout main
git log --oneline  # encontrar hash do commit bom
git reset --hard abc123
git push origin main --force

# Opção C: Fazer rollback no Render (via dashboard)
# Render > Service > Deploys > "Redeploy" do deploy anterior
```

---

## 🔧 Configuração Inicial

### 1. **Push das Branches para GitHub**

```bash
# Primeiro push de cada branch
git push -u origin main
git push -u origin staging
git push -u origin develop
```

### 2. **Configurar Preview Deploys no Render**

**Passo a passo:**

1. Acesse: https://dashboard.render.com
2. Selecione seu serviço: **age-run-controle-peso**
3. Vá em: **Settings** → **Preview Environments**
4. Configure:
   ```yaml
   Preview Branches: staging, feature/*
   Auto-Deploy: Yes
   ```
5. **Save Changes**

**O que acontece:**
- Push em `staging` → Cria preview automático
- Push em `feature/X` → Cria preview automático
- Push em `main` → Deploy em produção

### 3. **Proteger Branch Main (Recomendado)**

No GitHub:
1. **Repositório** → **Settings** → **Branches**
2. **Add rule** para `main`
3. Marcar:
   - ☑️ Require pull request before merging
   - ☑️ Require status checks to pass
4. **Create**

**Resultado:** Não pode mais fazer push direto na `main`, precisa de PR.

---

## 📊 Status das Branches

### Verificar onde cada feature está:

```bash
# Ver branches locais
git branch

# Ver branches remotas
git branch -r

# Ver commits únicos em cada branch
git log main..staging --oneline
git log staging..develop --oneline

# Ver diferenças entre branches
git diff main..staging
```

---

## 🎨 Boas Práticas

### ✅ **FAZER:**

- Sempre trabalhar em `develop` para novas features
- Testar em `staging` antes de produção
- Usar mensagens de commit claras:
  - `feat:` Nova funcionalidade
  - `fix:` Correção de bug
  - `chore:` Tarefas de manutenção
  - `docs:` Documentação
- Criar tags de versão para releases importantes
- Fazer backup antes de merge grande
- Pull antes de push (evita conflitos)

### ❌ **EVITAR:**

- Commit direto na `main` (exceto emergências)
- Push sem testar localmente
- Merge sem resolver conflitos
- Force push em branches compartilhadas
- Esquecer de propagar hotfixes para outras branches

---

## 🧪 Testar Preview Deploy

### Após push em staging:

```bash
# Push para staging
git push origin staging

# Aguarde ~2 minutos
# Render enviará notificação (se configurado)

# Verificar logs
# Render Dashboard > Service > Logs

# Acessar preview
# https://age-run-staging.onrender.com
```

### URLs de Preview:

- **Branch staging:** `https://age-run-staging.onrender.com`
- **Branch feature/X:** `https://age-run-pr-123.onrender.com`
- **Produção (main):** `https://age-run.onrender.com`

---

## 📅 Workflow Diário Recomendado

### **Segunda a Sexta:**

```bash
# 1. Começar o dia
git checkout develop
git pull origin develop
npm start  # Testar local

# 2. Desenvolver features
# ... trabalhar ...
git add .
git commit -m "feat: alguma coisa"
git push origin develop

# 3. Fim do dia: testar em staging
git checkout staging
git merge develop
git push origin staging
# → Testar preview URL
```

### **Final da Semana (Sexta):**

```bash
# Staging testado e aprovado?
git checkout main
git merge staging
git tag -a v1.x.0 -m "Release semanal"
git push origin main --tags
# → Deploy em produção
```

---

## 🆘 Comandos Úteis de Emergência

```bash
# Ver status de tudo
git status
git log --oneline --graph --all --decorate

# Descartar mudanças locais (CUIDADO!)
git checkout -- arquivo.js
git reset --hard HEAD

# Recuperar commit apagado
git reflog
git checkout abc123

# Limpar arquivos não rastreados
git clean -fd

# Salvar trabalho temporário
git stash
git stash pop

# Ver histórico de um arquivo
git log --follow -- arquivo.js
```

---

## 📚 Recursos

- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Render Preview Environments](https://render.com/docs/preview-environments)
- [Semantic Commit Messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)

---

## 🎯 Resumo Visual

```
┌─────────────────────────────────────────────────┐
│  DESENVOLVIMENTO LOCAL (develop)                │
│  • Trabalhar livremente                         │
│  • Testar em http://localhost:3001             │
│  • Commit frequente                             │
└─────────────────┬───────────────────────────────┘
                  │ merge quando feature completa
                  ↓
┌─────────────────────────────────────────────────┐
│  PRÉ-PRODUÇÃO (staging)                        │
│  • Preview Deploy automático                    │
│  • Testar em servidor real                      │
│  • Compartilhar com testers                     │
│  • URL: age-run-staging.onrender.com           │
└─────────────────┬───────────────────────────────┘
                  │ merge quando aprovado
                  ↓
┌─────────────────────────────────────────────────┐
│  PRODUÇÃO (main)                               │
│  • Deploy automático                            │
│  • Usuários finais acessam                      │
│  • URL: age-run.onrender.com                   │
│  • ESTÁVEL e TESTADO                            │
└─────────────────────────────────────────────────┘
```

---

**Criado em:** 20/05/2026  
**Versão:** 1.0  
**Sistema:** Age Run - Controle de Peso
