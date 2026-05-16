// Configuração da API
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api';

// Elementos do DOM
const pesagemForm = document.getElementById('pesagemForm');
const nomeInput = document.getElementById('nome');
const pesoInput = document.getElementById('peso');
const messageDiv = document.getElementById('message');
const rankingContainer = document.getElementById('rankingContainer');
const btnAtualizar = document.getElementById('btnAtualizar');
const historicoModal = document.getElementById('historicoModal');
const closeModal = document.querySelector('.close');

// Event Listeners
pesagemForm.addEventListener('submit', handleSubmitPesagem);
btnAtualizar.addEventListener('click', carregarRanking);
closeModal.addEventListener('click', fecharModal);
window.addEventListener('click', (e) => {
    if (e.target === historicoModal) {
        fecharModal();
    }
});

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    carregarEstatisticas();
    carregarRanking();
    
    // Atualizar a cada 30 segundos
    setInterval(() => {
        carregarEstatisticas();
        carregarRanking();
    }, 30000);
});

// ==================== FUNÇÕES PRINCIPAIS ====================

async function handleSubmitPesagem(e) {
    e.preventDefault();
    
    const nome = nomeInput.value.trim();
    const peso = parseFloat(pesoInput.value);
    
    if (!nome || !peso || peso <= 0) {
        mostrarMensagem('Por favor, preencha todos os campos corretamente', 'error');
        return;
    }
    
    try {
        // Buscar ou criar usuário
        const usuario = await buscarOuCriarUsuario(nome);
        
        // Registrar pesagem
        const response = await fetch(`${API_BASE}/pesagens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario_id: usuario.id,
                peso: peso
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao registrar pesagem');
        }
        
        const data = await response.json();
        
        mostrarMensagem(`✅ Pesagem registrada com sucesso! ${nome}: ${peso} kg`, 'success');
        
        // Limpar formulário
        pesoInput.value = '';
        pesoInput.focus();
        
        // Atualizar dados
        setTimeout(() => {
            carregarEstatisticas();
            carregarRanking();
        }, 500);
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('❌ Erro ao registrar pesagem. Tente novamente.', 'error');
    }
}

async function buscarOuCriarUsuario(nome) {
    const response = await fetch(`${API_BASE}/usuarios`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome })
    });
    
    if (!response.ok) {
        throw new Error('Erro ao buscar/criar usuário');
    }
    
    return await response.json();
}

async function carregarEstatisticas() {
    try {
        const response = await fetch(`${API_BASE}/estatisticas`);
        if (!response.ok) throw new Error('Erro ao carregar estatísticas');
        
        const stats = await response.json();
        
        document.getElementById('totalUsuarios').textContent = stats.total_usuarios || 0;
        document.getElementById('totalPesagens').textContent = stats.total_pesagens || 0;
        document.getElementById('perdaTotal').textContent = 
            `${stats.perda_total_kg || 0} kg`;
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

async function carregarRanking() {
    try {
        rankingContainer.innerHTML = '<div class="loading">Carregando ranking...</div>';
        
        const response = await fetch(`${API_BASE}/ranking`);
        if (!response.ok) throw new Error('Erro ao carregar ranking');
        
        const ranking = await response.json();
        
        if (ranking.length === 0) {
            rankingContainer.innerHTML = `
                <div class="loading">
                    <p>📊 Nenhum dado ainda.</p>
                    <p>Seja o primeiro a registrar sua pesagem!</p>
                </div>
            `;
            return;
        }
        
        renderizarRanking(ranking);
        
    } catch (error) {
        console.error('Erro ao carregar ranking:', error);
        rankingContainer.innerHTML = `
            <div class="loading" style="color: var(--danger-color);">
                ❌ Erro ao carregar ranking
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
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${ranking.map(item => renderizarLinhaRanking(item)).join('')}
            </tbody>
        </table>
    `;
    
    rankingContainer.innerHTML = tabela;
    
    // Adicionar event listeners aos botões de histórico
    document.querySelectorAll('.btn-historico').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const usuarioId = e.target.dataset.usuarioId;
            const nome = e.target.dataset.nome;
            abrirHistorico(usuarioId, nome);
        });
    });
}

function renderizarLinhaRanking(item) {
    const diferenca = parseFloat(item.diferenca);
    const classDiferenca = diferenca >= 0 ? 'perda-positiva' : 'perda-negativa';
    const sinalDiferenca = diferenca >= 0 ? '-' : '+';
    
    // Medalhas para top 3
    const medalhas = ['🥇', '🥈', '🥉'];
    const medalha = item.posicao <= 3 ? medalhas[item.posicao - 1] : '';
    
    const dataUltima = formatarData(item.ultima_pesagem);
    
    return `
        <tr>
            <td>
                <span class="medal">${medalha}</span>
                ${item.posicao}º
            </td>
            <td><strong>${item.nome}</strong></td>
            <td>${item.peso_maximo} kg</td>
            <td>${item.peso_atual} kg</td>
            <td class="${classDiferenca}">
                ${sinalDiferenca}${Math.abs(diferenca).toFixed(2)} kg
            </td>
            <td>${item.total_pesagens}</td>
            <td>
                <button class="btn-historico" 
                        data-usuario-id="${item.id}" 
                        data-nome="${item.nome}">
                    📊 Ver Histórico
                </button>
            </td>
        </tr>
    `;
}

async function abrirHistorico(usuarioId, nome) {
    try {
        const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/historico`);
        if (!response.ok) throw new Error('Erro ao carregar histórico');
        
        const historico = await response.json();
        
        document.getElementById('historicoNome').textContent = `📊 Histórico de ${nome}`;
        
        const historicoHTML = historico.length > 0 
            ? historico.map(item => `
                <div class="historico-item">
                    <div class="data">${formatarDataCompleta(item.data_pesagem)}</div>
                    <div class="peso-valor">${item.peso} kg</div>
                </div>
            `).join('')
            : '<p>Nenhum histórico encontrado.</p>';
        
        document.getElementById('historicoContent').innerHTML = historicoHTML;
        historicoModal.style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        alert('Erro ao carregar histórico');
    }
}

function fecharModal() {
    historicoModal.style.display = 'none';
}

// ==================== FUNÇÕES AUXILIARES ====================

function mostrarMensagem(texto, tipo) {
    messageDiv.textContent = texto;
    messageDiv.className = `message ${tipo} show`;
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
    }, 5000);
}

function formatarData(dataISO) {
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

function formatarDataCompleta(dataISO) {
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

// Adicionar suporte para Enter no campo de peso
pesoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        pesagemForm.dispatchEvent(new Event('submit'));
    }
});

// Auto-focus no campo nome ao carregar
nomeInput.focus();
