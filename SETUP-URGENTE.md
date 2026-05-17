# 🚨 AÇÃO NECESSÁRIA: Configurar PostgreSQL no Render

## ⚠️ Problema resolvido

O código foi migrado para usar **PostgreSQL em produção**, resolvendo a perda de dados no Render.

---

## 📋 Próximos passos (5 minutos)

### 1️⃣ Criar banco PostgreSQL no Render

1. Acesse: https://dashboard.render.com
2. Clique em **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `age-run-db`
   - **Region:** Mesma região do seu web service
   - **Plan:** **Free** ✅
4. Clique em **"Create Database"**
5. Aguarde até status **"Available"** (1-2 min)

### 2️⃣ Conectar ao seu Web Service

1. Na página do banco PostgreSQL, copie a **"Internal Database URL"**
2. Vá para seu Web Service: https://dashboard.render.com/web/srv-xxxxx
3. Clique em **"Environment"**
4. Adicione:
   - **Key:** `DATABASE_URL`
   - **Value:** [Cole a Internal URL]
5. **Save Changes**

### 3️⃣ Aguardar deploy

O Render vai fazer redeploy automaticamente. Acompanhe os logs:

```
🐘 Usando PostgreSQL
✅ Conectado ao banco de dados PostgreSQL
```

---

## ✅ Pronto!

Seus dados agora estão **permanentes** e **nunca mais serão perdidos** em deploys! 🎉

---

## 📖 Documentação completa

Ver: [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md)

---

**Importante:** Até configurar o PostgreSQL, o sistema continuará perdendo dados a cada deploy.
