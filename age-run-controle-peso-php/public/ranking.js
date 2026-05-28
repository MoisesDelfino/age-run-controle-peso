// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api'));

var usuarioLogado = usuarioLogado || null;

// Elementos DOM
const btnLogout = document.getElementById('btnLogout');
const btnAtualizar = document.getElementById('btnAtualizar');
const rankingContainer = document.getElementById('rankingContainer');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessao();
    await carregarVisaoRanking();
    
    // Atualizar a cada 30 segundos
    setInterval(() => {
        carregarVisaoRanking();
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

        if (isMulher()) {
            window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/pesagem' : '/controle/pesagem');
            return;
        }
        
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
    }
}

function isMulher() {
    return (usuarioLogado?.sexo || '').toLowerCase() === 'feminino';
}

async function handleLogout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            setTimeout(() => {
                window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            }, 100);
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// ==================== RANKING ====================

async function carregarVisaoRanking() {
    if (isMulher()) {
        await carregarEvolucaoPessoal();
        return;
    }

    await carregarRanking();
}

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

async function carregarEvolucaoPessoal() {
    try {
        const response = await fetch(`${API_BASE}/meu-historico`, {
            credentials: 'include'
        });

        if (!response.ok) {
            rankingContainer.innerHTML = '<p class="error-message">Erro ao carregar sua evolução</p>';
            return;
        }

        const historico = await response.json();
        const pesagensAtivas = (historico || []).filter(item => !item.excluido || item.excluido === 0);

        if (!pesagensAtivas.length) {
            rankingContainer.innerHTML = '<p class="empty-message">Registre pesagens para acompanhar sua evolução.</p>';
            return;
        }

        const pesoAtual = Number(pesagensAtivas[0].peso);
        const pesoInicial = Number(pesagensAtivas[pesagensAtivas.length - 1].peso);
        const diferenca = Number((pesoAtual - pesoInicial).toFixed(2));
        const percentual = pesoInicial > 0
            ? Number((((pesoInicial - pesoAtual) / pesoInicial) * 100).toFixed(2))
            : 0;

        rankingContainer.innerHTML = `
            <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                <div class="stat-card"><h4>Peso inicial</h4><p>${pesoInicial.toFixed(1)} kg</p></div>
                <div class="stat-card"><h4>Peso atual</h4><p>${pesoAtual.toFixed(1)} kg</p></div>
                <div class="stat-card"><h4>Diferença</h4><p>${diferenca >= 0 ? '+' : ''}${diferenca.toFixed(2)} kg</p></div>
                <div class="stat-card"><h4>Evolução</h4><p>${percentual.toFixed(2)}%</p></div>
                <div class="stat-card"><h4>Total de pesagens</h4><p>${pesagensAtivas.length}</p></div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar evolução pessoal:', error);
        rankingContainer.innerHTML = '<p class="error-message">Erro ao carregar sua evolução</p>';
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
                    <th>Perda %</th>
                    <th>Diferença (kg)</th>
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
    const usuarioIdItem = Number(item.usuario_id);
    const pesoInicial = Number(item.peso_inicial || 0);
    const pesoAtual = Number(item.peso_atual || 0);
    const percentualPerda = Number(item.percentual_perda || 0);
    const diferenca = Number(item.diferenca || 0);
    const totalPesagens = Number(item.total_pesagens || 0);

    const isUsuarioLogado = usuarioLogado && usuarioIdItem === Number(usuarioLogado.id);
    const rowClass = isUsuarioLogado ? 'usuario-logado' : '';
    const nomeDisplay = isUsuarioLogado ? `${item.nome} (Você)` : item.nome;
    
    const percentualClass = percentualPerda > 0 ? 'diferenca-positiva' : percentualPerda < 0 ? 'diferenca-negativa' : '';
    const diferencaClass = diferenca < 0 ? 'diferenca-positiva' : 'diferenca-negativa';
    
    return `
        <tr class="${rowClass}">
            <td>${medal} ${posicao}º</td>
            <td data-label="Nome">${nomeDisplay}</td>
            <td data-label="Peso Inicial">${pesoInicial.toFixed(1)} kg</td>
            <td data-label="Peso Atual">${pesoAtual.toFixed(1)} kg</td>
            <td data-label="Perda %" class="${percentualClass}">
                ${percentualPerda > 0 ? '-' : ''}${Math.abs(percentualPerda).toFixed(2)}%
            </td>
            <td data-label="Diferença (kg)" class="${diferencaClass}">
                ${diferenca >= 0 ? '+' : ''}${diferenca.toFixed(2)} kg
            </td>
            <td data-label="Pesagens">${totalPesagens}</td>
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
        await carregarVisaoRanking();
    });
}
