var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api'));

let emailRecuperacao = '';

// Elementos DOM
const etapa1 = document.getElementById('etapa1');
const etapa2 = document.getElementById('etapa2');
const solicitarCodigoForm = document.getElementById('solicitarCodigoForm');
const redefinirSenhaForm = document.getElementById('redefinirSenhaForm');
const message1 = document.getElementById('message1');
const message2 = document.getElementById('message2');
const codigoExibicao = document.getElementById('codigoExibicao');

// Etapa 1: Solicitar código
solicitarCodigoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    emailRecuperacao = email;
    
    try {
        const response = await fetch(`${API_BASE}/auth/solicitar-recuperacao`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Mensagem de sucesso
            let mensagem = data.message || 'Código enviado com sucesso!';
            
            if (data.warning) {
                // Se o envio falhar por configuração ou autenticação SMTP
                codigoExibicao.innerHTML = `
                    <div class="codigo-box warning-box">
                        <p><strong>⚠️ ${data.warning}</strong></p>
                        <p class="codigo-info">O código foi gerado mas não pôde ser enviado por e-mail.</p>
                        <p class="codigo-info">Revise as configurações SMTP no servidor e, se necessário, confira o <strong>console do servidor</strong>.</p>
                    </div>
                `;
            } else {
                // Email enviado com sucesso
                codigoExibicao.innerHTML = `
                    <div class="codigo-box success-box">
                        <p><strong>✅ Código enviado!</strong></p>
                        <p class="codigo-info">Verifique sua caixa de entrada e spam.</p>
                        <p class="codigo-info">O código é válido por 30 minutos.</p>
                    </div>
                `;
            }
            
            showMessage(message1, mensagem, 'success');
            
            // Trocar para etapa 2
            setTimeout(() => {
                etapa1.style.display = 'none';
                etapa2.style.display = 'block';
            }, 1000);
        } else {
            showMessage(message1, data.error || 'Erro ao solicitar recuperação', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showMessage(message1, 'Erro ao solicitar recuperação. Tente novamente.', 'error');
    }
});

// Etapa 2: Redefinir senha
redefinirSenhaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const codigo = document.getElementById('codigo').value.trim();
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;
    
    // Validar senhas
    if (novaSenha !== confirmarSenha) {
        showMessage(message2, 'As senhas não coincidem', 'error');
        return;
    }
    
    if (novaSenha.length < 6) {
        showMessage(message2, 'A senha deve ter no mínimo 6 caracteres', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/redefinir-senha`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailRecuperacao,
                codigo,
                novaSenha
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(message2, '✅ Senha redefinida com sucesso!', 'success');
            
            setTimeout(() => {
                window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            }, 2000);
        } else {
            showMessage(message2, data.error || 'Erro ao redefinir senha', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showMessage(message2, 'Erro ao redefinir senha. Tente novamente.', 'error');
    }
});

function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}
