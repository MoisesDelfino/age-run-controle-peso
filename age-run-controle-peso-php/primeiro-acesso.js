var API_BASE = API_BASE || (window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api'));

const formEl = document.getElementById('primeiroAcessoForm');
const novaSenhaEl = document.getElementById('novaSenha');
const confirmarSenhaEl = document.getElementById('confirmarSenha');
const messageEl = document.getElementById('message');
const toggleNovaSenhaEl = document.getElementById('toggleNovaSenha');
const toggleConfirmarSenhaEl = document.getElementById('toggleConfirmarSenha');

function redirectToHome() {
    window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/home' : '/controle/home');
}

function redirectToLogin() {
    window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
}

function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
}

function setupToggleButton(button, input) {
    if (!button || !input) return;

    button.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const icon = button.querySelector('.eye-icon');
        if (icon) {
            icon.textContent = isPassword ? 'visibility' : 'visibility_off';
        }

        button.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
    });
}

async function verificarSessaoPrimeiroAcesso() {
    const response = await fetch(`${API_BASE}/auth/session`, {
        credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok || !data?.authenticated) {
        redirectToLogin();
        return false;
    }

    if (!data?.require_password_change) {
        redirectToHome();
        return false;
    }

    return true;
}

async function alterarSenhaPrimeiroAcesso(novaSenha) {
    const response = await fetch(`${API_BASE}/auth/alterar-senha-primeiro-acesso`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ novaSenha })
    });

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Não foi possível alterar sua senha agora.');
    }

    return data;
}

if (formEl) {
    formEl.addEventListener('submit', async (event) => {
        event.preventDefault();

        const novaSenha = String(novaSenhaEl?.value || '');
        const confirmarSenha = String(confirmarSenhaEl?.value || '');

        if (novaSenha.length < 6) {
            showMessage('A senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }

        if (novaSenha !== confirmarSenha) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        try {
            showMessage('Salvando sua nova senha...', 'info');
            await alterarSenhaPrimeiroAcesso(novaSenha);
            showMessage('Senha alterada com sucesso. Redirecionando...', 'success');

            setTimeout(() => {
                redirectToHome();
            }, 1200);
        } catch (error) {
            showMessage(error.message || 'Falha ao alterar senha.', 'error');
        }
    });
}

setupToggleButton(toggleNovaSenhaEl, novaSenhaEl);
setupToggleButton(toggleConfirmarSenhaEl, confirmarSenhaEl);

verificarSessaoPrimeiroAcesso().catch(() => {
    redirectToLogin();
});
