// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : '/api');

// Elementos do DOM
const messageDiv = document.getElementById('message');

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

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const senha = senhaInput.value;
        
        if (!email || !senha) {
            mostrarMensagem('Por favor, preencha todos os campos', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, senha })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer login');
            }
            
            mostrarMensagem('✅ Login realizado! Redirecionando...', 'success');
            
            setTimeout(() => {
                window.location.href = '/home';
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
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar conta');
            }
            
            mostrarMensagem('✅ Conta criada! Redirecionando...', 'success');
            
            setTimeout(() => {
                window.location.href = '/home';
            }, 1000);
            
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem(`❌ ${error.message}`, 'error');
        }
    });
}

// ==================== FUNÇÕES AUXILIARES ====================

function mostrarMensagem(texto, tipo) {
    messageDiv.textContent = texto;
    messageDiv.className = `message ${tipo} show`;
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
    }, 5000);
}
