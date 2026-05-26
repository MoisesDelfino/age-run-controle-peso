# 🚀 Início Rápido - Controle de Peso Online

## ⚡ Começar em 3 Passos

### 1️⃣ Instalar Dependências

```bash
cd controle-peso-online
npm install
```

### 2️⃣ Iniciar o Sistema

```bash
npm start
```

### 3️⃣ Acessar

Abra seu navegador em: **http://localhost:3000**

---

## 📱 Como Usar

### Registrar Pesagem:

1. Digite seu nome
2. Digite seu peso atual (ex: 75.5)
3. Clique em "Registrar Pesagem"
4. Pronto! A data é registrada automaticamente

### Ver Ranking:

- O ranking atualiza automaticamente
- Mostra quem perdeu mais peso
- Top 3 recebe medalhas 🥇🥈🥉

### Ver Histórico:

- Clique em "📊 Ver Histórico" na linha do participante
- Veja todas as pesagens anteriores com data e hora

---

## 🎯 Funcionalidades

✅ Registro de peso com data automática  
✅ Ranking de perda de peso em tempo real  
✅ Histórico completo de pesagens  
✅ Estatísticas gerais do grupo  
✅ Interface responsiva (mobile e desktop)  
✅ Atualização automática a cada 30 segundos  

---

## 🌐 Colocar Online

Siga o guia completo em: [DEPLOY.md](DEPLOY.md)

**Recomendado**: Railway (mais fácil)

---

## 🛠️ Comandos Disponíveis

```bash
# Iniciar servidor
npm start

# Iniciar em modo desenvolvimento (auto-reload)
npm run dev

# Inicializar banco de dados manualmente
npm run init-db
```

---

## 📊 Estrutura do Projeto

```
controle-peso-online/
├── server.js           # Servidor Express + APIs
├── database.js         # Configuração SQLite
├── public/
│   ├── index.html     # Interface principal
│   ├── styles.css     # Estilos responsivos
│   └── app.js         # Lógica frontend
├── scripts/
│   └── init-db.js     # Script inicialização
├── package.json
└── README.md
```

---

## 💡 Dicas

- **Nome**: Digite exatamente igual em todas as pesagens
- **Peso**: Use ponto para decimais (ex: 75.5)
- **Mobile**: Funciona perfeitamente em celulares
- **Atualização**: O ranking atualiza sozinho

---

## 🆘 Problemas?

### Porta 3000 ocupada?

Edite `server.js` e mude para outra porta:
```javascript
const PORT = process.env.PORT || 3001;
```

### Banco não cria?

Execute manualmente:
```bash
npm run init-db
```

---

## 📞 Suporte

Dúvidas ou problemas? Entre em contato!

---

## 🎉 Pronto para usar!

Agora é só compartilhar o link com o grupo e começar a acompanhar a evolução de todos! 💪
