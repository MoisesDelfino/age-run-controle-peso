// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api'));

// Elementos do DOM
const pesagemForm = document.getElementById('pesagemForm');
const pesoInput = document.getElementById('peso');
const rankingContainer = document.getElementById('rankingContainer');
const btnAtualizar = document.getElementById('btnAtualizar');
const btnLogout = document.getElementById('btnLogout');
const userNameSpan = document.getElementById('userName');

var usuarioLogado = usuarioLogado || null;

// Event Listeners
if (pesagemForm) pesagemForm.addEventListener('submit', handleSubmitPesagem);
if (btnAtualizar) btnAtualizar.addEventListener('click', carregarRanking);
if (btnLogout) {
    console.log('Botão logout encontrado');
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Botão logout clicado');
        handleLogout();
    });
} else {
    console.error('Botão logout não encontrado!');
}

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessao();
    carregarRanking();
    
    // Atualizar a cada 30 segundos
    setInterval(() => {
        carregarRanking();
    }, 30000);
});

// ==================== AUTENTICAÇÃO ====================

async function verificarSessao() {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            return;
        }
        
        usuarioLogado = data;
        // Extrair apenas o primeiro nome
        const primeiroNome = usuarioLogado.nome.split(' ')[0];
        userNameSpan.textContent = primeiroNome;
        
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
    }
}

async function handleLogout() {
    console.log('handleLogout chamado');
    try {
        console.log('Fazendo requisição de logout...');
        const response = await fetch(`${API_BASE}/auth/logout`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        console.log('Resposta do logout:', response.status);
        
        // Forçar limpeza local
        usuarioLogado = null;
        
        // Sempre redirecionar, independente da resposta
        console.log('Redirecionando para /login');
        setTimeout(() => {
            window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        }, 100);
        
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        // Mesmo com erro, redirecionar para login
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
    }
}

// ==================== FUNÇÕES PRINCIPAIS ====================

async function handleSubmitPesagem(e) {
    e.preventDefault();
    
    const peso = parseFloat(pesoInput.value);
    
    if (!peso || peso <= 0) {
        mostrarMensagem('Por favor, informe um peso válido', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/pesagens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ peso })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Erro ao registrar pesagem');
        }
        
        const data = await response.json();
        
        mostrarMensagem(`✅ Pesagem registrada com sucesso! ${peso} kg`, 'success');
        
        // Limpar formulário
        pesoInput.value = '';
        pesoInput.focus();
        
        // Atualizar dados
        setTimeout(() => {
            carregarRanking();
        }, 500);
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem(`❌ ${error.message}`, 'error');
    }
}

async function carregarRanking() {
    console.log('carregarRanking chamado');
    try {
        rankingContainer.innerHTML = '<div class="loading">Carregando ranking...</div>';
        
        console.log('Fazendo requisição para:', `${API_BASE}/ranking`);
        const response = await fetch(`${API_BASE}/ranking`, {
            credentials: 'include'
        });
        
        console.log('Status da resposta do ranking:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta:', errorText);
            throw new Error(`Erro ao carregar ranking: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Ranking recebido:', data);
        
        // Extrair o array de ranking do objeto resposta
        const ranking = data.ranking || data;
        
        if (!ranking || ranking.length === 0) {
            rankingContainer.innerHTML = `
                <div class="loading">
                    <p>📊 Nenhum dado ainda.</p>
                    <p>Registre sua primeira pesagem!</p>
                </div>
            `;
            return;
        }
        
        renderizarRanking(ranking);
        
    } catch (error) {
        console.error('Erro ao carregar ranking:', error);
        rankingContainer.innerHTML = `
            <div class="loading" style="color: var(--danger-color);">
                ❌ Erro ao carregar ranking: ${error.message}
            </div>
        `;
    }
}

function renderizarRanking(ranking) {
    const tabela = `
        <table class="ranking-table">
            <thead>
                <tr>
                    <th>Posição</th>
                    <th>Nome</th>
                    <th>Peso Inicial</th>
                    <th>Peso Atual</th>
                    <th>Diferença</th>
                    <th>Pesagens</th>
                </tr>
            </thead>
            <tbody>
                ${ranking.map(item => renderizarLinhaRanking(item)).join('')}
            </tbody>
        </table>
    `;
    
    rankingContainer.innerHTML = tabela;
}

function renderizarLinhaRanking(item) {
    const diferenca = parseFloat(item.diferenca);
    const classDiferenca = diferenca >= 0 ? 'perda-positiva' : 'perda-negativa';
    const sinalDiferenca = diferenca >= 0 ? '-' : '+';
    
    // Medalhas para top 3
    const medalhas = ['🥇', '🥈', '🥉'];
    const posicao = item.posicao || 0;
    const medalha = posicao <= 3 ? medalhas[posicao - 1] : '';
    
    // Destacar usuário logado
    const itemId = item.usuario_id || item.id;
    const isUsuarioLogado = usuarioLogado && itemId === usuarioLogado.id;
    const classeDestaque = isUsuarioLogado ? 'usuario-logado' : '';
    
    return `
        <tr class="${classeDestaque}">
            <td>
                <span class="medal">${medalha}</span>
                ${posicao}º
            </td>
            <td><strong>${item.nome}${isUsuarioLogado ? ' (Você)' : ''}</strong></td>
            <td>${item.peso_inicial ? item.peso_inicial.toFixed(1) : '-'} kg</td>
            <td>${item.peso_atual ? item.peso_atual.toFixed(1) : '-'} kg</td>
            <td class="${classDiferenca}">
                ${sinalDiferenca}${Math.abs(diferenca).toFixed(2)} kg
            </td>
            <td>${item.total_pesagens}</td>
        </tr>
    `;
}

// ==================== FUNÇÕES AUXILIARES ====================

function mostrarMensagem(texto, tipo) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = texto;
        messageDiv.className = `message ${tipo} show`;
        
        setTimeout(() => {
            messageDiv.classList.remove('show');
        }, 5000);
    }
}

// Adicionar suporte para Enter no campo de peso
pesoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        pesagemForm.dispatchEvent(new Event('submit'));
    }
});

// Auto-focus no campo peso
pesoInput.focus();
