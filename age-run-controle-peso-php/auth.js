// Configuração da API
var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

// Elementos do DOM
const messageDiv = document.getElementById('message');
const resendVerificationBtn = document.getElementById('resendVerificationBtn');

function getAppPath(pagePath) {
    const basePath = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
    return `${basePath}${pagePath}`;
}

function hideResendVerificationButton() {
    if (!resendVerificationBtn) return;
    resendVerificationBtn.hidden = true;
    resendVerificationBtn.dataset.email = '';
}

function showResendVerificationButton(email) {
    if (!resendVerificationBtn || !email) return;
    resendVerificationBtn.dataset.email = email;
    resendVerificationBtn.hidden = false;
}

async function reenviarEmailConfirmacao(email) {
    const response = await fetch(`${API_BASE}/auth/reenviar-confirmacao`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email })
    });

    const data = await parseApiResponse(response);
    if (!response.ok) {
        throw new Error(data.error || `Erro ao reenviar confirmação (HTTP ${response.status})`);
    }

    return data;
}

function mostrarMensagem(texto, tipo, options = {}) {
    if (!messageDiv) return;

    const persist = Boolean(options.persist);
    messageDiv.textContent = texto;
    messageDiv.className = `message ${tipo} show`;
    
    if (!persist) {
        setTimeout(() => {
            messageDiv.classList.remove('show');
        }, 5000);
    }
}

function applyEmailConfirmationNotice() {
    if (!messageDiv) return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('email_confirmacao');
    const email = (params.get('email') || '').trim();
    if (!status) return;

    const notices = {
        pendente: {
            text: 'Conta criada. Verifique seu e-mail para confirmar o cadastro.',
            type: 'success',
            resend: true,
        },
        confirmado: {
            text: 'E-mail confirmado com sucesso. Faça login para continuar.',
            type: 'success',
        },
        'ja-confirmado': {
            text: 'Este e-mail já estava confirmado. Faça login normalmente.',
            type: 'success',
        },
        'token-expirado': {
            text: 'O link de confirmação expirou. Reenvie o e-mail de confirmação.',
            type: 'error',
            resend: true,
        },
        'token-invalido': {
            text: 'O link de confirmação é inválido ou já foi usado.',
            type: 'error',
        },
    };

    const notice = notices[status];
    if (!notice) return;

    mostrarMensagem(notice.text, notice.type, { persist: true });
    if (notice.resend && email) {
        showResendVerificationButton(email);
    } else {
        hideResendVerificationButton();
    }

    const emailInput = document.getElementById('email');
    if (emailInput && email) {
        emailInput.value = email;
    }
}

async function parseApiResponse(response) {
    const raw = await response.text();
    if (!raw || !raw.trim()) {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        return { error: `Resposta inválida do servidor (HTTP ${response.status})` };
    }
}

// ==================== TOGGLE MOSTRAR/OCULTAR SENHA ====================

// Toggle de mostrar/ocultar senha
const togglePasswordButtons = document.querySelectorAll('.toggle-password');
togglePasswordButtons.forEach(button => {
    button.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const eyeIcon = this.querySelector('.eye-icon');
        
        if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.textContent = 'visibility';
            this.setAttribute('aria-label', 'Ocultar senha');
        } else {
            input.type = 'password';
            eyeIcon.textContent = 'visibility_off';
            this.setAttribute('aria-label', 'Mostrar senha');
        }
    });
});

// ==================== FUNÇÕES DE AUTENTICAÇÃO ====================

// Login
if (document.getElementById('loginForm')) {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');

    applyEmailConfirmationNotice();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const senha = senhaInput.value;
        
        if (!email || !senha) {
            mostrarMensagem('Por favor, preencha todos os campos', 'error');
            return;
        }

        hideResendVerificationButton();
        
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, senha })
            });

            const data = await parseApiResponse(response);
            
            if (!response.ok) {
                if (response.status === 403 && data?.email_verification_required) {
                    showResendVerificationButton(email);
                }
                throw new Error(data.error || `Erro ao fazer login (HTTP ${response.status})`);
            }
            
            mostrarMensagem('✅ Login realizado! Redirecionando...', 'success');
            
            setTimeout(() => {
                if (data?.require_password_change) {
                    window.location.href = getAppPath('/primeiro-acesso');
                    return;
                }

                window.location.href = getAppPath('/home');
            }, 1000);
            
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem(`❌ ${error.message}`, 'error');
        }
    });
}

// Cadastro
if (document.getElementById('cadastroForm')) {
    const cadastroForm = document.getElementById('cadastroForm');
    const nomeInput = document.getElementById('nome');
    const emailInput = document.getElementById('email');
    const sexoInput = document.getElementById('sexo');
    const senhaInput = document.getElementById('senha');
    const confirmarSenhaInput = document.getElementById('confirmarSenha');

    cadastroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nome = nomeInput.value.trim();
        const email = emailInput.value.trim();
        const sexo = sexoInput.value;
        const senha = senhaInput.value;
        const confirmarSenha = confirmarSenhaInput.value;
        
        if (!nome || !email || !sexo || !senha || !confirmarSenha) {
            mostrarMensagem('Por favor, preencha todos os campos', 'error');
            return;
        }
        
        if (senha.length < 6) {
            mostrarMensagem('A senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }
        
        if (senha !== confirmarSenha) {
            mostrarMensagem('As senhas não coincidem', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/auth/cadastro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ nome, email, sexo, senha })
            });

            const data = await parseApiResponse(response);
            
            if (!response.ok) {
                throw new Error(data.error || `Erro ao criar conta (HTTP ${response.status})`);
            }
            
            mostrarMensagem('✅ Conta criada! Verifique seu e-mail para confirmar o cadastro.', 'success');
            
            setTimeout(() => {
                const nextUrl = `${getAppPath('/login')}?${new URLSearchParams({
                    email_confirmacao: 'pendente',
                    email,
                }).toString()}`;
                window.location.href = nextUrl;
            }, 1200);
            
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem(`❌ ${error.message}`, 'error');
        }
    });
}

if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('email');
        const email = (resendVerificationBtn.dataset.email || emailInput?.value || '').trim();
        if (!email) {
            mostrarMensagem('Informe o e-mail para reenviar a confirmação.', 'error');
            return;
        }

        resendVerificationBtn.disabled = true;
        try {
            const data = await reenviarEmailConfirmacao(email);
            mostrarMensagem(`✅ ${data.message || 'E-mail de confirmação reenviado.'}`, 'success', { persist: true });
            showResendVerificationButton(email);
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem(`❌ ${error.message}`, 'error', { persist: true });
        } finally {
            resendVerificationBtn.disabled = false;
        }
    });
}
