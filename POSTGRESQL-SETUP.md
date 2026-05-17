# Configuração PostgreSQL no Render

## 🎯 Por que PostgreSQL?

O Render tem **filesystem efêmero** - cada deploy recria o ambiente limpo, apagando o arquivo SQLite.
PostgreSQL resolve isso permanentemente, mantendo os dados entre deploys.

---

## 📋 Passo a passo completo

### 1. Criar banco PostgreSQL no Render

1. Acesse https://dashboard.render.com
2. Clique em **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `age-run-db` (ou nome de sua preferência)
   - **Database:** `age_run_peso` (gerado automaticamente)
   - **User:** `age_run_user` (gerado automaticamente)
   - **Region:** Mesma do seu serviço web (para melhor performance)
   - **PostgreSQL Version:** 16 (mais recente)
   - **Plan:** **Free** ($0/mês)
4. Clique em **"Create Database"**
5. Aguarde 1-2 minutos até o status ficar **"Available"**

### 2. Conectar ao Web Service

1. Na página do banco PostgreSQL, copie a **"Internal Database URL"**
   - Formato: `postgresql://user:password@dpg-xxxxx/database`
   - Esta URL é interna e mais rápida (sem sair da rede do Render)

2. Vá para seu Web Service: https://dashboard.render.com/web/srv-xxxxx
3. Clique na aba **"Environment"**
4. Adicione uma nova variável:
   - **Key:** `DATABASE_URL`
   - **Value:** Cole a Internal Database URL copiada
5. Clique em **"Save Changes"**

### 3. Deploy automático

O Render detectará a mudança de variável de ambiente e fará redeploy automaticamente.

Acompanhe os logs:
```
🐘 Usando PostgreSQL
✅ Conectado ao banco de dados PostgreSQL
📊 Tabelas criadas/verificadas com sucesso
```

---

## ✅ Verificação

Após o deploy:
1. Acesse https://age-run-controle-peso.onrender.com
2. Faça login
3. Registre uma pesagem
4. **Faça um novo deploy** (push qualquer commit)
5. Verifique que os dados **permaneceram** 🎉

---

## 🔧 Desenvolvimento local

### Continua usando SQLite

O código detecta automaticamente o ambiente:
- **Produção (Render):** PostgreSQL (via `DATABASE_URL`)
- **Desenvolvimento (localhost):** SQLite (`peso.db`)

Não precisa configurar nada localmente!

```bash
npm start  # Usa SQLite automaticamente
```

---

## 📊 Gerenciar o banco

### Via Render Dashboard

1. Acesse seu banco PostgreSQL no dashboard
2. Clique na aba **"Shell"**
3. Execute comandos SQL:

```sql
-- Ver todos os usuários
SELECT * FROM usuarios;

-- Ver todas as pesagens
SELECT * FROM pesagens WHERE excluido = 0;

-- Contar usuários com pesagens
SELECT COUNT(DISTINCT usuario_id) FROM pesagens;
```

### Via cliente PostgreSQL (psql)

Use a **External Database URL** (na página do banco):

```bash
psql postgresql://user:password@host/database
```

---

## 🚨 Migração de dados existentes

Se você tinha dados no SQLite local e quer migrar para produção:

### Opção 1: Cadastrar novamente (Recomendado)
Os usuários fazem novo cadastro no sistema em produção.

### Opção 2: Exportar/Importar (Avançado)
```bash
# 1. Exportar do SQLite local
sqlite3 peso.db .dump > backup.sql

# 2. Converter para PostgreSQL (manual - ajustar sintaxe)
# 3. Importar via psql usando External URL
```

---

## 🎯 Vantagens

✅ **Dados persistentes** - Nunca mais perde dados em deploys
✅ **Gratuito** - Plano free do Render
✅ **Automático** - Código detecta ambiente
✅ **Robusto** - PostgreSQL é production-ready
✅ **Escalável** - Fácil upgrade para plano pago se precisar

---

## 📝 Notas importantes

- **Free tier do PostgreSQL:**
  - 1 GB de armazenamento
  - Suficiente para milhares de usuários
  - Expira após 90 dias de inatividade (apenas deleta, não cobra)

- **Backup:**
  - Render faz backup automático (planos pagos)
  - No free tier, faça backup manual via `pg_dump` se quiser

- **Performance:**
  - Use sempre a **Internal Database URL** no web service
  - Mais rápido que External (mesma rede interna)

---

## 🆘 Troubleshooting

### Erro: "column excluido does not exist"
A coluna `excluido` foi adicionada depois. Execute:

```sql
ALTER TABLE pesagens ADD COLUMN excluido INTEGER DEFAULT 0;
```

### Erro de conexão SSL
A configuração já está correta no código:
```javascript
ssl: { rejectUnauthorized: false }
```

### Código ainda usa SQLite em produção
Verifique que a variável `DATABASE_URL` está configurada no Render.

---

## ✅ Checklist final

- [ ] Banco PostgreSQL criado no Render
- [ ] `DATABASE_URL` adicionada no Web Service
- [ ] Deploy realizado com sucesso
- [ ] Logs mostram "Usando PostgreSQL"
- [ ] Dados persistem entre deploys
- [ ] Sistema funcionando normalmente

---

**Data:** 17/05/2026  
**Versão:** 2.0 - PostgreSQL Production
