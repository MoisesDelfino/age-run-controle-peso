// Configuração da API
const API_BASE = 'http://localhost:3000/api';

let usuarioLogado = null;

// Elementos DOM
const btnLogout = document.getElementById('btnLogout');
const btnAtualizar = document.getElementById('btnAtualizar');
const rankingContainer = document.getElementById('rankingContainer');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessao();
    await carregarRanking();
    
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
            window.location.href = '/login';
            return;
        }
        
        usuarioLogado = data.usuario;
        
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        window.location.href = '/login';
    }
}

async function handleLogout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            setTimeout(() => {
                window.location.href = '/login';
            }, 100);
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// ==================== RANKING ====================

async function carregarRanking() {
    try {
        console.log('carregarRanking chamado');
        console.log('Fazendo requisição para:', `${API_BASE}/ranking`);
        
        const response = await fetch(`${API_BASE}/ranking`, {
            credentials: 'include'
        });
        
        console.log('Status da resposta do ranking:', response.status);
        const data = await response.json();
        console.log('Ranking recebido:', data);
        
        if (response.ok) {
            renderizarRanking(data.ranking);
        } else {
            rankingContainer.innerHTML = '<p class="error-message">Erro ao carregar ranking</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar ranking:', error);
        rankingContainer.innerHTML = '<p class="error-message">Erro ao carregar ranking</p>';
    }
}

function renderizarRanking(ranking) {
    console.log('renderizarRanking chamado com', ranking.length, 'itens');
    
    if (ranking.length === 0) {
        rankingContainer.innerHTML = '<p class="empty-message">Nenhum dado disponível ainda.</p>';
        return;
    }
    
    let html = `
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
    `;
    
    ranking.forEach((item, index) => {
        html += renderizarLinhaRanking(item, index + 1);
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    rankingContainer.innerHTML = html;
}

function renderizarLinhaRanking(item, posicao) {
    const medal = posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : '';
    const isUsuarioLogado = usuarioLogado && item.usuario_id === usuarioLogado.id;
    const rowClass = isUsuarioLogado ? 'usuario-logado' : '';
    const nomeDisplay = isUsuarioLogado ? `${item.nome} (Você)` : item.nome;
    
    return `
        <tr class="${rowClass}">
            <td>${medal} ${posicao}º</td>
            <td>${nomeDisplay}</td>
            <td>${item.peso_inicial.toFixed(1)} kg</td>
            <td>${item.peso_atual.toFixed(1)} kg</td>
            <td class="${item.diferenca < 0 ? 'diferenca-positiva' : 'diferenca-negativa'}">
                ${item.diferenca >= 0 ? '+' : ''}${item.diferenca.toFixed(2)} kg
            </td>
            <td>${item.total_pesagens}</td>
        </tr>
    `;
}

// ==================== EVENT LISTENERS ====================

if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

if (btnAtualizar) {
    btnAtualizar.addEventListener('click', async () => {
        await carregarRanking();
    });
}
