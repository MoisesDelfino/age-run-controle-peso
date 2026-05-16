// Configuração da API
const API_BASE = 'http://localhost:3000/api';

let usuarioLogado = null;

// Elementos DOM
const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessao();
});

// ==================== AUTENTICAÇÃO ====================

async function verificarSessao() {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login';
            return;
        }
        
        usuarioLogado = data.usuario;
        // Extrair apenas o primeiro nome
        const primeiroNome = usuarioLogado.nome.split(' ')[0];
        userNameSpan.textContent = primeiroNome;
        
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        window.location.href = '/login';
    }
}

async function handleLogout() {
    try {
        console.log('Botão logout clicado');
        console.log('handleLogout chamado');
        
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        console.log('Resposta do logout:', response.status);
        
        if (response.ok) {
            console.log('Logout bem-sucedido, redirecionando...');
            setTimeout(() => {
                console.log('Redirecionando para /login');
                window.location.href = '/login';
            }, 100);
        } else {
            console.error('Erro no logout:', response.status);
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// Event Listeners
if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
    console.log('Botão logout encontrado');
}
