# 🎯 INSTRUÇÕES COMPLETAS - Sistema de Controle de Peso Online

## 📋 O QUE FOI CRIADO?

Um sistema web completo para substituir a planilha do Google Sheets, com:

✅ **Registro de Pesagens**: Nome + Peso + Data automática  
✅ **Dashboard**: Estatísticas em tempo real  
✅ **Ranking**: Quem perdeu mais peso com medalhas 🥇🥈🥉  
✅ **Histórico**: Todas as pesagens de cada pessoa  
✅ **Responsivo**: Funciona perfeitamente no celular  
✅ **100% Online**: Pode ser acessado de qualquer lugar  

---

## 🚀 COMO USAR AGORA (LOCAL)

O servidor já está rodando em: **http://localhost:3000**

### 1. Abra o navegador e acesse:
```
http://localhost:3000
```

### 2. Teste o sistema:
- Digite seu nome: "Moises"
- Digite um peso: "92.5"
- Clique em "Registrar Pesagem"

### 3. Veja o ranking se atualizar automaticamente!

---

## 📊 IMPORTAR DADOS DA PLANILHA

Para trazer todos os dados da planilha atual para o sistema:

### Opção Rápida:
```bash
# Parar o servidor (Ctrl+C no terminal onde está rodando)
# Depois executar:
npm run importar

# Reiniciar servidor:
npm start
```

Isso importará TODOS os 23 participantes da planilha com os dados atuais!

---

## 🌐 COLOCAR 100% ONLINE (DEPLOY)

Para que todos possam acessar de qualquer lugar:

### 🥇 **Recomendação #1: Railway** (Mais Fácil)

1. Crie uma conta em: https://railway.app
2. Conecte com GitHub
3. Crie um novo projeto
4. Escolha "Deploy from GitHub repo"
5. Selecione a pasta do projeto
6. Railway faz tudo automaticamente!
7. **Você receberá uma URL tipo**: `https://seu-app.railway.app`

**Tempo**: ~5 minutos  
**Custo**: Gratuito (plano inicial)

### 🥈 **Opção #2: Render**

1. Acesse: https://render.com
2. Crie conta gratuita
3. "New +" → "Web Service"
4. Conecte o repositório
5. Configure:
   - Build: `npm install`
   - Start: `npm start`
6. Deploy!

**Tempo**: ~5-10 minutos  
**Custo**: Gratuito

### 📖 Guia Completo de Deploy:
Veja o arquivo [DEPLOY.md](DEPLOY.md) para instruções detalhadas.

---

## 📱 COMO OS PARTICIPANTES VÃO USAR

### No Celular ou Computador:

1. **Acessar**: URL que você vai compartilhar
2. **Registrar Peso**:
   - Digitar nome (sempre igual)
   - Digitar peso atual
   - Enviar
3. **Ver Ranking**: Atualiza automaticamente
4. **Ver Histórico**: Clicar no botão ao lado do nome

**Simples assim!** 🎉

---

## 📂 ESTRUTURA DO PROJETO

```
controle-peso-online/
├── 📄 server.js              # Servidor + APIs
├── 📄 database.js            # Banco de dados SQLite
├── 📁 public/
│   ├── index.html           # Interface web
│   ├── styles.css           # Design responsivo
│   └── app.js               # Lógica do frontend
├── 📁 scripts/
│   ├── init-db.js           # Inicializa banco
│   └── importar-planilha.js # Importa dados
├── 📄 package.json
├── 📄 README.md
├── 📄 QUICKSTART.md         # Início rápido
├── 📄 DEPLOY.md             # Deploy online
└── 📄 IMPORTAR.md           # Importar planilha
```

---

## 🛠️ COMANDOS ÚTEIS

```bash
# Iniciar servidor
npm start

# Modo desenvolvimento (auto-reload)
npm run dev

# Importar dados da planilha
npm run importar

# Inicializar banco do zero
npm run init-db
```

---

## 💡 DICAS IMPORTANTES

### Para os Participantes:
1. **Nome**: Sempre digitar EXATAMENTE igual
   - Correto: "Moises" (sempre assim)
   - Errado: "moises", "Moisés", "Moises " (com espaço)

2. **Peso**: Usar ponto para decimais
   - Correto: 92.5
   - Errado: 92,5

3. **Data**: Automática, não precisa informar! ⏰

### Para o Administrador:
- O sistema atualiza sozinho a cada 30 segundos
- Dados ficam salvos no arquivo `peso.db`
- Para backup: copiar o arquivo `peso.db`

---

## 🎨 CARACTERÍSTICAS DO SISTEMA

### Interface Responsiva:
- ✅ Desktop (computador)
- ✅ Tablet
- ✅ Smartphone (iOS e Android)

### Funcionalidades:
- ✅ Ranking com medalhas para top 3
- ✅ Diferença em cores (verde = perdeu, vermelho = ganhou)
- ✅ Estatísticas gerais do grupo
- ✅ Histórico individual completo
- ✅ Atualização automática em tempo real

---

## 🔒 SEGURANÇA

- Dados salvos localmente no servidor
- Sem necessidade de login (simplicidade)
- SQLite (banco leve e confiável)
- Após deploy: HTTPS automático (Railway/Render)

---

## 📞 PRÓXIMOS PASSOS

### Agora Mesmo:
1. ✅ Testar localmente: http://localhost:3000
2. ⬜ Importar dados da planilha: `npm run importar`
3. ⬜ Testar com dados reais
4. ⬜ Fazer deploy online (Railway recomendado)
5. ⬜ Compartilhar URL com o grupo

### Depois do Deploy:
1. Informar o grupo sobre o novo sistema
2. Enviar a URL de acesso
3. Dar instruções básicas (nome + peso)
4. Abandonar a planilha antiga! 🎉

---

## 🆘 SUPORTE

### Problemas Comuns:

**"Porta 3000 em uso"**
```bash
# Usar outra porta
PORT=3001 npm start
```

**"Banco não encontrado"**
```bash
npm run init-db
```

**"Dados não aparecem"**
- Verificar se executou `npm run importar`
- Atualizar a página (F5)

---

## 🎉 CONCLUSÃO

Você agora tem um **sistema profissional** de controle de peso que substitui completamente a planilha!

**Vantagens sobre a planilha:**
- ✅ Mais rápido para usar
- ✅ Interface amigável e bonita
- ✅ Ranking automático
- ✅ Histórico completo
- ✅ Acessível de qualquer dispositivo
- ✅ Não precisa de conta Google
- ✅ Dados organizados e seguros

**Pronto para colocar online e usar!** 🚀💪

---

## 📧 COMPARTILHAR COM O GRUPO

Exemplo de mensagem após deploy:

```
🏃‍♂️ ATENÇÃO GRUPO AGE RUN! 🏃‍♂️

Nosso novo sistema de controle de peso está no ar! 🎉

🌐 Acesse: https://seu-app.railway.app

📝 Como usar:
1. Abra o link
2. Digite seu nome (sempre igual)
3. Digite seu peso atual
4. Envie!

🏆 O ranking atualiza automaticamente!

Funciona no celular também! 📱

Não usem mais a planilha antiga.
Usem apenas o novo sistema! 💪

Dúvidas? Me chamem!
```

---

## ✨ FIM

**Desenvolvido com ❤️ para o grupo Age Run**

*Sistema criado para facilitar o acompanhamento de peso e motivar todos a alcançarem seus objetivos! 💪🏃‍♂️*
