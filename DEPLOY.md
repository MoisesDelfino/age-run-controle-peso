# Guia de Deploy - Controle de Peso Online

Este guia mostra como fazer deploy do sistema em diferentes plataformas.

## 🚀 Opção 1: Railway (Recomendado)

Railway é uma plataforma moderna e fácil de usar.

### Passos:

1. Acesse [railway.app](https://railway.app)
2. Crie uma conta (pode usar GitHub)
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha o repositório do projeto
6. Railway detectará automaticamente que é um app Node.js
7. O deploy será feito automaticamente!

### Configurações:

Railway usará automaticamente:
- `npm install` para instalar dependências
- `npm start` para iniciar o servidor
- Variável `PORT` será configurada automaticamente

### URL:

Após o deploy, Railway fornecerá uma URL como:
`https://seu-app.railway.app`

---

## 🌐 Opção 2: Render

Render é outra excelente opção gratuita.

### Passos:

1. Acesse [render.com](https://render.com)
2. Crie uma conta
3. Clique em "New +" → "Web Service"
4. Conecte seu repositório GitHub
5. Configure:
   - **Name**: controle-peso
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Clique em "Create Web Service"

### URL:

`https://controle-peso.onrender.com`

---

## 📦 Opção 3: Vercel (Para sites estáticos + Serverless)

Vercel é ótimo para sites estáticos e pode usar serverless functions.

### Passos:

1. Acesse [vercel.com](https://vercel.com)
2. Importe o repositório GitHub
3. Configure:
   - **Framework Preset**: Other
   - **Build Command**: Deixe vazio
   - **Output Directory**: public
4. Deploy!

**Nota**: Para Vercel, seria necessário adaptar as APIs para Serverless Functions.

---

## 🐳 Opção 4: VPS próprio (Digital Ocean, AWS, etc.)

Se você tem um servidor próprio:

```bash
# Conectar ao servidor
ssh user@seu-servidor.com

# Clonar repositório
git clone https://github.com/seu-usuario/controle-peso-online.git
cd controle-peso-online

# Instalar dependências
npm install

# Inicializar banco
npm run init-db

# Instalar PM2 (gerenciador de processos)
npm install -g pm2

# Iniciar aplicação
pm2 start server.js --name controle-peso

# Configurar para iniciar no boot
pm2 startup
pm2 save

# Configurar nginx como proxy reverso
sudo nano /etc/nginx/sites-available/controle-peso
```

Configuração Nginx:
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 Configurar HTTPS (Recomendado)

### Para Railway/Render/Vercel:
HTTPS é configurado automaticamente! ✅

### Para VPS próprio:
Use Certbot (Let's Encrypt):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

---

## 📱 Testar no Mobile

Após o deploy:

1. Acesse a URL fornecida pelo celular
2. Teste adicionar uma pesagem
3. Verifique se o ranking atualiza
4. Teste o histórico

---

## 🔍 Solução de Problemas

### Banco de dados não persiste:

- **Railway/Render**: Adicione um volume persistente
- Configure o path do banco: `./data/peso.db`

### Erros de CORS:

O código já está configurado com CORS habilitado.

### Porta não configurada:

Certifique-se que o `PORT` está sendo lido de `process.env.PORT`

---

## 📊 Monitoramento

### Logs no Railway:
```bash
railway logs
```

### Logs no Render:
Acesse o dashboard e veja a aba "Logs"

### Logs no VPS:
```bash
pm2 logs controle-peso
```

---

## 🎉 Pronto!

Agora seu sistema está online e acessível de qualquer lugar!

Compartilhe a URL com os participantes do grupo Age Run.
