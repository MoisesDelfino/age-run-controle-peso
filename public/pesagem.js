// Configuração da API
const API_BASE = 'http://localhost:3000/api';

let usuarioLogado = null;

// Elementos DOM
const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');
const pesagemForm = document.getElementById('pesagemForm');
const messageDiv = document.getElementById('message');
const historicoContainer = document.getElementById('historicoContainer');

// Variáveis globais para modais
let pesagemEditandoId = null;
let pesagemExcluindoId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSessao();
    await carregarHistorico();
    
    // Preencher campo de data com a data atual
    const dataInput = document.getElementById('data');
    if (dataInput) {
        const hoje = new Date();
        const dataFormatada = hoje.toISOString().split('T')[0];
        dataInput.value = dataFormatada;
    }
    
    // Event listener para o formulário de edição
    const formEditarPesagem = document.getElementById('formEditarPesagem');
    if (formEditarPesagem) {
        formEditarPesagem.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarEdicaoPesagem();
        });
    }
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

// ==================== PESAGENS ====================

async function registrarPesagem(peso, data) {
    try {
        const response = await fetch(`${API_BASE}/pesagens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ peso, data_pesagem: data })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Pesagem registrada com sucesso! 🎉', 'success');
            pesagemForm.reset();
            await carregarHistorico();
        } else {
            showMessage(result.error || 'Erro ao registrar pesagem', 'error');
        }
    } catch (error) {
        console.error('Erro ao registrar pesagem:', error);
        showMessage('Erro ao registrar pesagem. Tente novamente.', 'error');
    }
}

async function carregarHistorico() {
    try {
        const response = await fetch(`${API_BASE}/pesagens/usuario/${usuarioLogado.id}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            renderizarHistorico(data.pesagens);
        } else {
            historicoContainer.innerHTML = '<p class="error-message">Erro ao carregar histórico</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        historicoContainer.innerHTML = '<p class="error-message">Erro ao carregar histórico</p>';
    }
}

function renderizarHistorico(pesagens) {
    if (pesagens.length === 0) {
        historicoContainer.innerHTML = '<p class="empty-message">Nenhuma pesagem registrada ainda.</p>';
        return;
    }
    
    const pesoInicial = pesagens[pesagens.length - 1].peso;
    const pesoAtual = pesagens[0].peso;
    const diferenca = pesoAtual - pesoInicial;
    
    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Peso Inicial</div>
                <div class="stat-value">${pesoInicial.toFixed(1)} kg</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Peso Atual</div>
                <div class="stat-value">${pesoAtual.toFixed(1)} kg</div>
            </div>
            <div class="stat-card ${diferenca < 0 ? 'stat-positive' : 'stat-negative'}">
                <div class="stat-label">Diferença</div>
                <div class="stat-value">${diferenca >= 0 ? '+' : ''}${diferenca.toFixed(1)} kg</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total de Pesagens</div>
                <div class="stat-value">${pesagens.length}</div>
            </div>
        </div>
        
        <h3>Últimas Pesagens</h3>
        <div class="historico-list">
    `;
    
    pesagens.slice(0, 10).forEach(pesagem => {
        const data = new Date(pesagem.data_pesagem);
        const dataFormatada = data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        html += `
            <div class="historico-item">
                <div class="historico-info">
                    <span class="historico-peso">${pesagem.peso.toFixed(1)} kg</span>
                    <span class="historico-data">${dataFormatada}</span>
                </div>
                <div class="historico-actions">
                    <button class="btn-edit" onclick="editarPesagem(${pesagem.id}, ${pesagem.peso})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-delete" onclick="excluirPesagem(${pesagem.id}, ${pesagem.peso})" title="Excluir">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    historicoContainer.innerHTML = html;
}

function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// ==================== EDITAR/EXCLUIR/RESTAURAR ====================

function editarPesagem(id, pesoAtual) {
    pesagemEditandoId = id;
    document.getElementById('pesoAtualModal').textContent = `${pesoAtual} kg`;
    document.getElementById('novoPeso').value = pesoAtual;
    document.getElementById('modalEditar').style.display = 'flex';
    setTimeout(() => document.getElementById('novoPeso').focus(), 100);
}

function fecharModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
    pesagemEditandoId = null;
}

async function salvarEdicaoPesagem() {
    const novoPesoNum = parseFloat(document.getElementById('novoPeso').value);
    
    if (isNaN(novoPesoNum) || novoPesoNum <= 0) {
        showMessage('❌ Por favor, insira um peso válido', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/pesagens/${pesagemEditandoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ peso: novoPesoNum })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('✅ Pesagem atualizada com sucesso!', 'success');
            fecharModalEditar();
            await carregarHistorico();
        } else {
            showMessage(`❌ ${data.error || 'Erro ao atualizar pesagem'}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao editar pesagem:', error);
        showMessage('❌ Erro ao atualizar pesagem. Tente novamente.', 'error');
    }
}

function excluirPesagem(id, peso) {
    pesagemExcluindoId = id;
    document.getElementById('pesoExcluirModal').textContent = `${peso} kg`;
    document.getElementById('modalExcluir').style.display = 'flex';
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').style.display = 'none';
    pesagemExcluindoId = null;
}

async function confirmarExclusao() {
    try {
        const response = await fetch(`${API_BASE}/pesagens/${pesagemExcluindoId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('✅ Pesagem excluída com sucesso!', 'success');
            fecharModalExcluir();
            await carregarHistorico();
        } else {
            showMessage(`❌ ${data.error || 'Erro ao excluir pesagem'}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir pesagem:', error);
        showMessage('❌ Erro ao excluir pesagem. Tente novamente.', 'error');
    }
}

// Expor funções globalmente para os botões inline
window.editarPesagem = editarPesagem;
window.excluirPesagem = excluirPesagem;
window.fecharModalEditar = fecharModalEditar;
window.fecharModalExcluir = fecharModalExcluir;
window.confirmarExclusao = confirmarExclusao;

// ==================== EVENT LISTENERS ====================

if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

if (pesagemForm) {
    pesagemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const peso = parseFloat(document.getElementById('peso').value);
        const data = document.getElementById('data').value;
        
        if (!data) {
            showMessage('Por favor, selecione uma data', 'error');
            return;
        }
        
        if (peso <= 0 || peso > 500) {
            showMessage('Por favor, insira um peso válido (entre 0 e 500 kg)', 'error');
            return;
        }
        
        await registrarPesagem(peso, data);
    });
}
