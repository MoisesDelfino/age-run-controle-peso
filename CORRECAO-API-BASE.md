# Correção: API_BASE hardcoded causando erro em produção

## 🐛 Problema

Após fazer login em produção (https://age-run-controle-peso.onrender.com), o usuário era imediatamente redirecionado de volta para a tela de login.

## 🔍 Causa Raiz

Os arquivos JavaScript do frontend tinham o `API_BASE` hardcoded para `localhost:3000`:

```javascript
const API_BASE = 'http://localhost:3000/api';  // ❌ Não funciona em produção
```

**Arquivos afetados:**
- `public/home.js`
- `public/pesagem.js`
- `public/ranking.js`
- `public/recuperar-senha.js`

Quando a página `home.html` carregava em produção, ela tentava fazer requisição para verificar a sessão:

```javascript
const response = await fetch(`${API_BASE}/auth/session`, {
    credentials: 'include'
});
```

Como `API_BASE` apontava para `localhost:3000`, a requisição falhava em produção, e o código redirecionava para `/login` automaticamente.

## ✅ Solução

Alterado `API_BASE` para detectar automaticamente o ambiente:

```javascript
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'  // Desenvolvimento
    : '/api';                        // Produção (usa caminho relativo)
```

**Funcionamento:**
- **Desenvolvimento (localhost):** Usa `http://localhost:3000/api`
- **Produção (Render):** Usa `/api` (caminho relativo, resolvido automaticamente para `https://age-run-controle-peso.onrender.com/api`)

## 📝 Observações

O arquivo `auth.js` já estava correto desde o início com essa lógica. Os outros arquivos não haviam sido atualizados durante as correções anteriores de sessão.

## ✅ Validação

Após o deploy:
1. Login funciona normalmente
2. Sessão persiste após login
3. Não há redirecionamento involuntário
4. Todas as páginas autenticadas funcionam corretamente

---
**Data:** 16/05/2026  
**Commit:** 7cdba8a - "Fix: Corrige API_BASE para funcionar em produção (detecta ambiente automaticamente)"
