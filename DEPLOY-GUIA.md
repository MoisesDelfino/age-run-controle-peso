# 🚀 DEPLOY NA WEB - Age Run

Este guia mostra como fazer o deploy da aplicação no **Render.com** (gratuito e fácil).

## ✅ PRÉ-REQUISITOS

1. Conta no GitHub (gratuita)
2. Conta no Render.com (gratuita)
3. Git instalado no seu computador

---

## 📦 PASSO 1: PREPARAR O CÓDIGO

### 1.1 Inicializar Git (se ainda não fez)

```bash
cd "/home/moises-delfino/Área de trabalho/controle-peso-online"
git init
git add .
git commit -m "Initial commit - Age Run Sistema Controle Peso"
```

### 1.2 Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Nome do repositório: `age-run-controle-peso`
3. Descrição: `Sistema de controle de peso com dashboard e ranking`
4. Deixe **Público** ou **Privado** (sua escolha)
5. **NÃO** marque "Initialize with README"
6. Clique em **"Create repository"**

### 1.3 Enviar Código para o GitHub

Copie e execute os comandos que o GitHub mostrar, algo como:

```bash
git remote add origin https://github.com/SEU-USUARIO/age-run-controle-peso.git
git branch -M main
git push -u origin main
```

---

## 🌐 PASSO 2: DEPLOY NO RENDER

### 2.1 Criar Conta no Render

1. Acesse: https://render.com/
2. Clique em **"Get Started"** ou **"Sign Up"**
3. Escolha **"Sign in with GitHub"** (recomendado)
4. Autorize o Render a acessar seus repositórios

### 2.2 Criar Novo Web Service

1. No painel do Render, clique em **"New +"**
2. Selecione **"Web Service"**
3. Conecte seu repositório:
   - Clique em **"Connect account"** se necessário
   - Busque por `age-run-controle-peso`
   - Clique em **"Connect"**

### 2.3 Configurar o Service

Preencha os campos:

**Nome:** `age-run-controle-peso` (ou outro nome único)

**Region:** Escolha a mais próxima (ex: `Oregon (US West)` ou `Frankfurt (Europe)`)

**Branch:** `main`

**Root Directory:** (deixe em branco)

**Runtime:** `Node`

**Build Command:** `npm install`

**Start Command:** `npm start`

**Plan:** Selecione **"Free"**

### 2.4 Variáveis de Ambiente

Role para baixo até **"Environment Variables"** e adicione:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_FROM_NAME` | `Age Run` |
| `EMAIL_FROM_ADDRESS` | `noreply@agerun.com` |

**OPCIONAL (para envio de emails):**
| Key | Value |
|-----|-------|
| `EMAIL_USER` | `seu-email@gmail.com` |
| `EMAIL_PASS` | `sua-senha-de-app-16-caracteres` |

### 2.5 Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o deploy (2-5 minutos)
3. Você verá os logs em tempo real

### 2.6 Sucesso! 🎉

Quando aparecer **"Your service is live 🎉"**, sua aplicação está no ar!

URL: `https://age-run-controle-peso.onrender.com` (ou o nome que você escolheu)

---

## 📱 ACESSAR DE QUALQUER LUGAR

Agora você pode acessar de:
- ✅ Qualquer computador
- ✅ Celular (Android/iPhone)
- ✅ Tablet
- ✅ Qualquer navegador

Basta compartilhar o link: `https://age-run-controle-peso.onrender.com`

---

## ⚙️ CONFIGURAÇÕES ADICIONAIS

### Domínio Personalizado (Opcional)

1. No Render, vá em **"Settings"**
2. Role até **"Custom Domain"**
3. Clique em **"Add Custom Domain"**
4. Digite seu domínio (ex: `agerun.com.br`)
5. Configure DNS conforme instruções do Render

### SSL/HTTPS

✅ **Já vem configurado automaticamente!** Render fornece SSL grátis.

### Banco de Dados

O SQLite (`peso.db`) será criado automaticamente no primeiro acesso.

**⚠️ IMPORTANTE:** No plano gratuito do Render, o banco de dados é limpo quando o serviço fica inativo por muito tempo. Para produção séria, considere:
- Migrar para PostgreSQL (Render oferece gratuito)
- Usar Render Disks (pago, mas mantém dados)

---

## 🔄 ATUALIZAÇÕES

### Como Atualizar o Site

Sempre que fizer alterações no código:

```bash
git add .
git commit -m "Descrição da alteração"
git push
```

O Render detecta automaticamente e faz o deploy da nova versão!

---

## 🐛 PROBLEMAS COMUNS

### Site não carrega após deploy

**Solução:**
1. Vá em **"Logs"** no painel do Render
2. Procure por erros em vermelho
3. Geralmente é falta de variável de ambiente

### Build falha

**Solução:**
1. Verifique se `package.json` está correto
2. Confirme que todas as dependências estão listadas
3. Teste localmente com `npm install && npm start`

### "Service Unavailable" (503)

**Solução:**
- No plano gratuito, o serviço "dorme" após 15 minutos sem uso
- Primeiro acesso após inatividade demora ~30 segundos para "acordar"
- É normal e esperado no plano gratuito

### Banco de dados vazio

**Solução:**
- No primeiro acesso, cadastre um usuário
- Plano gratuito pode resetar dados se inativo por muito tempo
- Para produção, use PostgreSQL

---

## 💰 CUSTOS

### Plano Gratuito (Render)

✅ **Totalmente grátis** para sempre!

**Limitações:**
- Serviço "dorme" após 15 minutos de inatividade
- 750 horas/mês (suficiente para uso pessoal/testes)
- Disco pode ser limpo periodicamente
- CPU/RAM limitados

### Plano Pago (Opcional)

Se precisar de mais recursos:

**Starter ($7/mês):**
- Serviço sempre ativo (não dorme)
- Recursos garantidos
- Disco persistente

**Professional ($25/mês):**
- Mais CPU e RAM
- Escalonamento automático
- Suporte prioritário

---

## 🎯 PRÓXIMOS PASSOS

### Após Deploy

1. ✅ Acesse a URL gerada
2. ✅ Crie sua conta
3. ✅ Teste todas as funcionalidades
4. ✅ Compartilhe o link com os usuários

### Melhorias Futuras

- [ ] Migrar para PostgreSQL (banco mais robusto)
- [ ] Configurar domínio personalizado
- [ ] Adicionar Google Analytics
- [ ] Implementar backup automático
- [ ] Adicionar mais funcionalidades

---

## 📞 SUPORTE

**Render:** https://render.com/docs
**GitHub:** https://docs.github.com

---

## ✅ CHECKLIST DE DEPLOY

- [ ] Código enviado para GitHub
- [ ] Conta no Render criada
- [ ] Web Service criado no Render
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy concluído com sucesso
- [ ] Site acessível pelo link gerado
- [ ] Conta de teste criada
- [ ] Funcionalidades testadas
- [ ] Link compartilhado com usuários

---

🎉 **PARABÉNS! Sua aplicação está na web!**
