const nodemailer = require('nodemailer');
require('dotenv').config();

// Verificar se credenciais estão configuradas
const isConfigured = process.env.EMAIL_USER && 
                     process.env.EMAIL_PASS && 
                     !process.env.EMAIL_USER.includes('seu-email') &&
                     !process.env.EMAIL_PASS.includes('sua-senha');

let transporter = null;

if (isConfigured) {
  // Configuração real do SMTP
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true para 465, false para outras portas
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  console.log('📧 Serviço de e-mail configurado');
} else {
  console.log('⚠️  Credenciais de e-mail não configuradas');
  console.log('💡 Configure o arquivo .env para enviar e-mails reais');
  console.log('📝 Por enquanto, códigos serão exibidos no console');
}

/**
 * Envia código de recuperação de senha
 * @param {string} email - E-mail do destinatário
 * @param {string} nome - Nome do usuário
 * @param {string} codigo - Código de 6 dígitos
 * @returns {Promise<boolean>} - True se enviado com sucesso
 */
async function enviarCodigoRecuperacao(email, nome, codigo) {
  const primeiroNome = nome.split(' ')[0];
  
  // Se não estiver configurado, apenas loga no console
  if (!isConfigured) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  📧 CÓDIGO DE RECUPERAÇÃO             ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Para: ${email.padEnd(32)}║`);
    console.log(`║  Usuário: ${primeiroNome.padEnd(29)}║`);
    console.log(`║  Código: ${codigo}                      ║`);
    console.log(`║  Válido: 30 minutos                    ║`);
    console.log('╚════════════════════════════════════════╝\n');
    return true;
  }

  // HTML do email
  const htmlEmail = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
          color: #333;
        }
        .message {
          color: #666;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .codigo-box {
          background: linear-gradient(135deg, #8BC34A 0%, #7CB342 100%);
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
        }
        .codigo-label {
          color: white;
          font-size: 14px;
          margin-bottom: 10px;
          opacity: 0.9;
        }
        .codigo {
          font-size: 48px;
          font-weight: bold;
          color: white;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
        }
        .codigo-validade {
          color: white;
          font-size: 14px;
          margin-top: 10px;
          opacity: 0.9;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          color: #856404;
        }
        .footer {
          background: #f5f5f5;
          padding: 20px 30px;
          text-align: center;
          color: #999;
          font-size: 12px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: #8BC34A;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 20px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏃‍♂️ Age Run</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema de Controle de Peso</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Olá, ${primeiroNome}! 👋
          </div>
          
          <div class="message">
            <p>Você solicitou a recuperação de senha da sua conta no Age Run.</p>
            <p>Use o código abaixo para redefinir sua senha:</p>
          </div>
          
          <div class="codigo-box">
            <div class="codigo-label">SEU CÓDIGO DE RECUPERAÇÃO</div>
            <div class="codigo">${codigo}</div>
            <div class="codigo-validade">⏰ Válido por 30 minutos</div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Atenção:</strong> Se você não solicitou esta recuperação de senha, ignore este e-mail. Sua senha permanecerá a mesma.
          </div>
          
          <div class="message">
            <p>Para sua segurança:</p>
            <ul>
              <li>Não compartilhe este código com ninguém</li>
              <li>O código expira em 30 minutos</li>
              <li>Caso não funcione, solicite um novo código</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Age Run - Sistema de Controle de Peso</strong></p>
          <p>Sua Vida Transformada pela Corrida. Com Propósito, Segurança e Comunidade.</p>
          <p style="margin-top: 15px; color: #ccc;">
            Este é um e-mail automático, por favor não responda.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    // Enviar email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: email,
      subject: '🔐 Código de Recuperação de Senha - Age Run',
      html: htmlEmail,
      text: `
Age Run - Recuperação de Senha

Olá, ${primeiroNome}!

Você solicitou a recuperação de senha da sua conta.

Seu código de recuperação: ${codigo}

Este código é válido por 30 minutos.

Se você não solicitou esta recuperação, ignore este e-mail.

---
Age Run - Sistema de Controle de Peso
      `
    });

    console.log('✅ E-mail enviado:', info.messageId);
    console.log('📧 Para:', email);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    
    // Fallback: exibir no console se falhar
    console.log('\n⚠️  FALHA NO ENVIO - Código exibido no console:');
    console.log(`Para: ${email}`);
    console.log(`Código: ${codigo}`);
    console.log('Válido por 30 minutos\n');
    
    return false;
  }
}

module.exports = {
  enviarCodigoRecuperacao,
  isConfigured
};
