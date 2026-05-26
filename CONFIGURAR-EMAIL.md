# 📧 Como Configurar o Envio de E-mails

O sistema está configurado para enviar códigos de recuperação de senha por e-mail. 

## ⚡ CONFIGURAÇÃO RÁPIDA (Gmail)

### 1. Gerar Senha de App no Gmail

1. Acesse: https://myaccount.google.com/apppasswords
2. Se solicitado, faça login na sua conta Google
3. Selecione **"Selecionar app"** → **"Outro (nome personalizado)"**
4. Digite: **"Age Run Recovery"**
5. Clique em **"Gerar"**
6. Copie a senha de 16 caracteres (sem espaços)

### 2. Editar arquivo `.env`

Abra o arquivo `.env` na raiz do projeto e substitua:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu-email@gmail.com         ← Seu email do Gmail
EMAIL_PASS=abcd efgh ijkl mnop         ← Cola a senha de 16 caracteres aqui

EMAIL_FROM_NAME=Age Run
EMAIL_FROM_ADDRESS=noreply@agerun.com
```

### 3. Reiniciar o Servidor

```bash
npm start
```

Pronto! Os e-mails serão enviados automaticamente.

---

## 🔧 OUTROS PROVEDORES DE E-MAIL

### Outlook/Hotmail

```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=seu-email@outlook.com
EMAIL_PASS=sua-senha-normal
```

### Yahoo

```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USER=seu-email@yahoo.com
EMAIL_PASS=sua-senha-de-app
```

**Nota:** Yahoo também requer senha de app. Configure em: https://login.yahoo.com/account/security

### SendGrid (Profissional)

1. Crie conta em: https://sendgrid.com/
2. Gere uma API Key
3. Configure:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.sua-api-key-aqui
EMAIL_FROM_ADDRESS=seu-email-verificado@seudominio.com
```

### Mailgun (Profissional)

1. Crie conta em: https://mailgun.com/
2. Verifique seu domínio
3. Configure:

```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@seu-dominio.mailgun.org
EMAIL_PASS=sua-senha-mailgun
```

---

## 🧪 MODO DESENVOLVIMENTO

Se as credenciais não estiverem configuradas, o sistema:

- ✅ Continua funcionando normalmente
- 📝 Exibe o código no **console do servidor** (terminal)
- ⚠️ Avisa o usuário que o email não foi configurado

Para ver o código no modo desenvolvimento:
1. Solicite recuperação de senha
2. Olhe no terminal onde o servidor está rodando
3. O código aparecerá em uma caixa destacada

---

## ❓ PROBLEMAS COMUNS

### "Senha incorreta" (Gmail)

- ❌ Não use sua senha normal do Gmail
- ✅ Use a **senha de app** de 16 caracteres
- Verifique se a verificação em 2 etapas está ativada

### "Acesso bloqueado" (Gmail)

1. Ative verificação em 2 etapas: https://myaccount.google.com/security
2. Depois gere a senha de app

### E-mails indo para spam

- Configure SPF/DKIM no seu domínio
- Use um provedor profissional (SendGrid, Mailgun)
- Peça aos usuários para adicionar seu email aos contatos

### "Connection timeout"

- Verifique firewall/antivírus
- Confirme que a porta 587 está aberta
- Tente porta 465 (secure: true no nodemailer)

---

## 📋 CHECKLIST

- [ ] Arquivo `.env` editado com credenciais reais
- [ ] Senha de app gerada (Gmail/Yahoo)
- [ ] Servidor reiniciado após configurar
- [ ] Teste de recuperação de senha realizado
- [ ] E-mail recebido na caixa de entrada

---

## 🎨 PERSONALIZAÇÃO

Para personalizar o template do e-mail, edite o arquivo:

```
emailService.js
```

Você pode modificar:
- Cores e estilos CSS
- Texto e mensagens
- Estrutura do HTML
- Logo e branding

---

## 🚀 PRONTO PARA PRODUÇÃO

Quando for para produção:

1. ✅ Use provedor profissional (SendGrid, Mailgun, AWS SES)
2. ✅ Configure domínio personalizado
3. ✅ Adicione registros SPF, DKIM, DMARC
4. ✅ Monitore taxa de entrega
5. ✅ Implemente rate limiting (limite de tentativas)
6. ✅ Adicione logs de auditoria

---

Precisa de ajuda? Consulte a documentação do seu provedor de e-mail ou do Nodemailer: https://nodemailer.com/
