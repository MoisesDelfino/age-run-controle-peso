// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : '/api');

var usuarioLogado = usuarioLogado || null;

// Elementos DOM
const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessao();
});

// ==================== AUTENTICAÇÃO ====================

async function verificarSessao(tentativas = 3) {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            if (tentativas > 0) {
                await new Promise(resolve => setTimeout(resolve, 400));
                return verificarSessao(tentativas - 1);
            }

            window.location.href = '/controle/login';
            return false;
        }
        
        usuarioLogado = data;
        // Extrair apenas o primeiro nome
        const primeiroNome = usuarioLogado.nome?.split(' ')[0] || '';
        if (userNameSpan) {
            userNameSpan.textContent = primeiroNome;
        }

        return true;
        
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        if (tentativas > 0) {
            await new Promise(resolve => setTimeout(resolve, 400));
            return verificarSessao(tentativas - 1);
        }

        window.location.href = '/controle/login';
        return false;
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
                window.location.href = '/controle/login';
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
