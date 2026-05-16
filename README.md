# Sistema de Controle de Peso Online 🏃‍♂️

Sistema web completo de controle de peso do **Age Run** com autenticação individual, dashboard e ranking em tempo real.

## 🎯 Funcionalidades

- ✅ **Autenticação individual** com e-mail e senha
- ✅ **Registro simplificado** - apenas o peso (sistema identifica automaticamente)
- ✅ **Dashboard personalizado** com saudação
- ✅ **Ranking em tempo real** com destaque do usuário logado
- ✅ **100% online e acessível** de qualquer dispositivo
- ✅ **Interface responsiva** mobile-first
- ✅ **Cores Age Run** - verde predominante, roxo secundário
- ✅ **Logo oficial integrada**

## 🚀 Início Rápido

### Instalação

\`\`\`bash
# Instalar dependências
npm install

# Iniciar servidor
npm start
\`\`\`

O sistema estará disponível em \`http://localhost:3000\`

### Primeiro Acesso

**Credenciais de teste:**
- E-mail: \`moises@agerun.com\`
- Senha: \`age123\`

*Veja todas as credenciais em [CREDENCIAIS.md](CREDENCIAIS.md)*

## 📱 Como Usar

### Login:
1. Acesse o sistema
2. Digite seu e-mail e senha
3. Faça login

### Registrar Peso:
1. Digite apenas seu peso atual
2. Clique em "Registrar Pesagem"
3. Sistema registra automaticamente com seu nome e data

### Ver Ranking:
- O ranking atualiza automaticamente
- Você aparece destacado em verde
- Top 3 recebe medalhas 🥇🥈🥉

## 🎨 Design

- **Verde Age Run** (#8BC34A) - Cor predominante
- **Roxo** (#7B1FA2) - Cor secundária
- **Logo oficial** integrada no header
- **Interface limpa** e intuitiva
- **Responsivo** para todos os dispositivos

## 🔐 Segurança

- Senhas criptografadas com bcrypt
- Sessões seguras (7 dias)
- Autenticação obrigatória
- Proteção de rotas
- Dados individualizados

## 🌐 Deploy

Pronto para deploy em:
- Railway (recomendado)
- Render
- Vercel
- Heroku
- VPS próprio

Veja o guia completo: [DEPLOY.md](DEPLOY.md)

## 📊 Tecnologias

- **Backend**: Node.js + Express
- **Banco**: SQLite3
- **Autenticação**: bcrypt + express-session
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla
- **Design**: Responsivo, Mobile-first

## 📄 Documentação

- [ATUALIZACAO_COMPLETA.md](ATUALIZACAO_COMPLETA.md) - Mudanças recentes
- [CREDENCIAIS.md](CREDENCIAIS.md) - Lista de usuários
- [DEPLOY.md](DEPLOY.md) - Guia de deploy
- [QUICKSTART.md](QUICKSTART.md) - Início rápido

## 🎉 Recursos

### Para Usuários:
- Login individual
- Registro rápido de peso
- Visualização do ranking
- Destaque no ranking
- Logout seguro

### Para Administradores:
- 23 usuários pré-cadastrados
- Todas as pesagens preservadas
- Sistema seguro
- Fácil gerenciamento

## 🔧 Comandos

\`\`\`bash
# Iniciar servidor
npm start

# Modo desenvolvimento
npm run dev

# Migrar dados (já executado)
npm run migrar
\`\`\`

## 💡 Diferencial

**Antes:** Sistema aberto onde qualquer um digitava nome e peso  
**Agora:** Sistema individualizado com login, cada pessoa tem sua conta e registra apenas o peso

## 🏆 Age Run

Sistema desenvolvido com as cores e identidade visual do grupo Age Run.

**Verde**: Saúde, crescimento, evolução  
**Roxo**: Determinação, força, união

---

**🏃‍♂️ Bora pra cima! Juntos na busca pelos nossos objetivos! 💪**
