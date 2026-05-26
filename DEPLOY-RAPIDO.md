# 🚀 DEPLOY RÁPIDO - 3 Passos

## ✅ PASSO 1: GITHUB (2 minutos)

### 1.1 Criar Repositório

1. Abra: https://github.com/new
2. Nome: `age-run-controle-peso`
3. Deixe **Público**
4. **NÃO** marque "Initialize with README"
5. Clique **"Create repository"**

### 1.2 Enviar Código

Copie e execute NO TERMINAL:

```bash
cd "/home/moises-delfino/Área de trabalho/controle-peso-online"

git remote add origin https://github.com/SEU-USUARIO/age-run-controle-peso.git

git branch -M main

git push -u origin main
```

**⚠️ Substitua:** `SEU-USUARIO` pelo seu usuário do GitHub

✅ **Código no GitHub!**

---

## 🌐 PASSO 2: RENDER (3 minutos)

### 2.1 Criar Conta

1. Abra: https://render.com/
2. Clique **"Get Started"**
3. Escolha **"Sign in with GitHub"** (mais fácil)
4. Autorize o acesso

### 2.2 Criar Web Service

1. Clique **"New +"** (canto superior direito)
2. Selecione **"Web Service"**
3. Clique **"Connect account"** se necessário
4. Busque: `age-run-controle-peso`
5. Clique **"Connect"** no repositório

### 2.3 Configurar

**Name:** `age-run-controle-peso` (ou qualquer nome)

**Region:** `Oregon (US West)` ou mais próximo

**Branch:** `main`

**Runtime:** `Node`

**Build Command:** `npm install`

**Start Command:** `npm start`

**Plan:** Selecione **"Free"** ✅

### 2.4 Variáveis de Ambiente (Opcional)

Role até **"Environment Variables"**

Adicione (opcional, só para emails funcionarem):

- `EMAIL_USER` → `seu-email@gmail.com`
- `EMAIL_PASS` → `sua-senha-de-app-16-digitos`

*Se não adicionar, códigos aparecerão no console*

### 2.5 Deploy!

1. Clique **"Create Web Service"** (botão verde no final)
2. Aguarde 2-5 minutos ⏳
3. Veja os logs em tempo real

✅ **Quando aparecer "Your service is live 🎉" está pronto!**

---

## 🎉 PASSO 3: ACESSAR!

### Seu Site está no ar! 🚀

**URL:** `https://age-run-controle-peso.onrender.com`
*(ou o nome que você escolheu)*

### Testar:

1. Abra o link no navegador
2. Crie uma conta
3. Teste as funcionalidades
4. Compartilhe o link com outros usuários!

### Compartilhar:

📱 **Funciona em:**
- ✅ Celular (Android/iPhone)
- ✅ Tablet
- ✅ Computador
- ✅ Qualquer navegador

🔗 **Link direto:** https://age-run-controle-peso.onrender.com

---

## 🔄 ATUALIZAR SITE

Fez alterações no código? Simples:

```bash
git add .
git commit -m "Descrição da alteração"
git push
```

O Render detecta e atualiza automaticamente! ✨

---

## ⚠️ IMPORTANTE (Plano Gratuito)

### Limitações:

- 🌙 Site "dorme" após 15 minutos sem uso
- 🐌 Primeiro acesso demora ~30 segundos (acordar)
- 📊 Pode perder dados se ficar muito tempo inativo
- 💾 Banco SQLite limitado

### Soluções:

**Para uso pessoal/testes:** Plano gratuito é perfeito! ✅

**Para uso profissional:**
- Upgrade para plano pago ($7/mês) → site sempre ativo
- Migrar banco para PostgreSQL (gratuito no Render)

---

## 🆘 PROBLEMAS?

### Site não carrega

1. Vá em **"Logs"** no painel do Render
2. Procure erros em vermelho
3. Geralmente falta variável de ambiente

### Build falha

Teste localmente:
```bash
npm install
npm start
```

Se funcionar local, funciona no Render.

### 503 Service Unavailable

Normal no plano gratuito! Site está "acordando".
Espere 30 segundos e recarregue.

---

## 📞 SUPORTE

**Render Docs:** https://render.com/docs
**GitHub Docs:** https://docs.github.com

---

## ✅ CHECKLIST

- [ ] Código no GitHub
- [ ] Conta no Render criada
- [ ] Web Service configurado
- [ ] Deploy concluído
- [ ] Site acessível
- [ ] Conta teste criada
- [ ] Link compartilhado

---

🎊 **PARABÉNS! Seu site está na WEB!**

**URL:** https://age-run-controle-peso.onrender.com
