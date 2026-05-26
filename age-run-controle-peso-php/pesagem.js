// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : '/controle/api');

var usuarioLogado = usuarioLogado || null;

// Elementos DOM
const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');
const pesagemForm = document.getElementById('pesagemForm');
const messageDiv = document.getElementById('message');
const statsContainer = document.getElementById('statsContainer');
const listaContainer = document.getElementById('listaContainer');

// Variáveis globais para modais
let pesagemEditandoId = null;
let pesagemExcluindoId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    const autenticado = await verificarSessao();
    if (autenticado) {
        await carregarHistorico();
        // Equalizar alturas após carregar o conteúdo
        setTimeout(equalizarAlturas, 100);
    }
    
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
    
    // Event listener para botão Salvar Altura
    const btnSalvarAltura = document.getElementById('btnSalvarAltura');
    if (btnSalvarAltura) {
        btnSalvarAltura.addEventListener('click', salvarAltura);
    }
});

// Equalizar alturas dos cards em desktop
function equalizarAlturas() {
    // Só executar em desktop (>= 1200px)
    if (window.innerWidth < 1200) {
        // Limpar alturas forçadas em mobile/tablet
        const statsCard = document.querySelector('.stats-section .card');
        const listaCard = document.querySelector('.lista-section .card');
        if (statsCard) statsCard.style.height = '';
        if (listaCard) listaCard.style.height = '';
        return;
    }
    
    const formSection = document.querySelector('.form-section');
    const statsCard = document.querySelector('.stats-section .card');
    const listaCard = document.querySelector('.lista-section .card');
    
    if (!formSection || !statsCard || !listaCard) {
        console.log('❌ Elementos não encontrados');
        return;
    }
    
    // Resetar alturas para medir altura natural
    statsCard.style.height = '';
    listaCard.style.height = '';
    
    // Aguardar o layout se estabilizar
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Calcular altura TOTAL da coluna esquerda (Registrar Pesagem + Altura + gap 20px)
            const formHeight = formSection.getBoundingClientRect().height;
            
            console.log('📏 Altura TOTAL da coluna esquerda (2 cards + gap):', formHeight);
            
            // Aplicar altura diretamente nos outros cards
            statsCard.style.height = `${formHeight}px`;
            listaCard.style.height = `${formHeight}px`;
            
            console.log('✅ Cards igualados - todos com:', formHeight + 'px');
        });
    });
}

// Reequilibrar ao redimensionar
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(equalizarAlturas, 200);
});

// ==================== AUTENTICAÇÃO ====================

async function verificarSessao() {
    console.log('🔐 Verificando sessão...');
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });
        console.log('📡 Resposta do /auth/session, status:', response.status);
        const data = await response.json();
        console.log('📦 Dados da sessão:', data);
        
        if (!data.authenticated) {
            console.log('❌ Usuário não autenticado, redirecionando...');
            window.location.href = '/controle/login';
            return false;
        }
        
        usuarioLogado = data;
        console.log('✅ Usuário logado:', usuarioLogado);
        // Extrair apenas o primeiro nome
        const primeiroNome = usuarioLogado.nome.split(' ')[0];
        userNameSpan.textContent = primeiroNome;
        
        // Carregar altura se existir
        if (usuarioLogado.altura) {
            const alturaInput = document.getElementById('altura');
            if (alturaInput) {
                alturaInput.value = usuarioLogado.altura;
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao verificar sessão:', error);
        window.location.href = '/controle/login';
        return false;
    }
}

// ==================== ALTURA ====================

async function salvarAltura() {
    const alturaInput = document.getElementById('altura');
    const messageDiv = document.getElementById('messageAltura');
    
    if (!alturaInput || !alturaInput.value) {
        messageDiv.textContent = 'Por favor, informe sua altura.';
        messageDiv.className = 'message error';
        mostrarNotificacao('⚠️ Por favor, informe sua altura.', 'warning');
        return;
    }
    
    const altura = parseFloat(alturaInput.value);
    
    // Validar altura
    if (isNaN(altura) || altura < 0.5 || altura > 2.5) {
        messageDiv.textContent = 'Altura inválida. Use valores entre 0.5 e 2.5 metros.';
        messageDiv.className = 'message error';
        mostrarNotificacao('❌ Altura inválida. Use valores entre 0.5 e 2.5 metros.', 'error');
        return;
    }
    
    try {
        console.log('💾 Salvando altura:', altura);
        const response = await fetch(`${API_BASE}/usuarios/altura`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ altura })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Altura salva:', data);
            usuarioLogado.altura = altura; // Atualizar cache local
            messageDiv.textContent = '✅ Altura salva com sucesso!';
            messageDiv.className = 'message success';
            
            // Mostrar notificação toast
            mostrarNotificacao('✅ Altura salva! Vá para a aba Bioimpedância para ver o IMC atualizado.', 'success', 5000);
            
            // Notificar outras abas que a altura foi atualizada
            localStorage.setItem('altura_atualizada', Date.now().toString());
            
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = 'message';
            }, 3000);
        } else {
            const error = await response.json();
            console.error('❌ Erro ao salvar altura:', error);
            mostrarNotificacao('❌ Erro ao salvar altura: ' + (error.error || 'Erro desconhecido'), 'error');
            throw new Error(error.error || 'Erro ao salvar altura');
        }
    } catch (error) {
        console.error('Erro:', error);
        messageDiv.textContent = 'Erro ao salvar altura. Tente novamente.';
        messageDiv.className = 'message error';
        mostrarNotificacao('❌ Erro ao salvar altura. Tente novamente.', 'error');
    }
}

async function salvarAlturaSeAlterada() {
    const alturaInput = document.getElementById('altura');
    if (!alturaInput || !alturaInput.value) return;
    
    const altura = parseFloat(alturaInput.value);
    
    // Validar altura
    if (isNaN(altura) || altura < 0.5 || altura > 2.5) {
        showMessage('Altura inválida. Use valores entre 0.5 e 2.5 metros.', 'error');
        return;
    }
    
    // Verificar se altura já está salva e é diferente
    if (usuarioLogado.altura && Math.abs(usuarioLogado.altura - altura) < 0.01) {
        return; // Não mudou, não salvar
    }
    
    try {
        console.log('💾 Salvando altura:', altura);
        const response = await fetch(`${API_BASE}/usuarios/altura`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ altura })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Altura salva:', data);
            usuarioLogado.altura = altura; // Atualizar cache local
            showMessage('Altura salva com sucesso!', 'success');
        } else {
            const error = await response.json();
            console.error('❌ Erro ao salvar altura:', error);
            throw new Error(error.error || 'Erro ao salvar altura');
        }
    } catch (error) {
        console.error('Erro:', error);
        showMessage('Erro ao salvar altura. Tente novamente.', 'error');
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
                window.location.href = '/controle/login';
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
    console.log('🔍 carregarHistorico chamado, usuarioLogado:', usuarioLogado);
    
    // Verificar se o usuário está logado
    if (!usuarioLogado || !usuarioLogado.id) {
        console.error('❌ Usuário não logado ou sem ID');
        return;
    }
    
    try {
        console.log('📡 Fazendo requisição para:', `${API_BASE}/pesagens/usuario/${usuarioLogado.id}`);
        const response = await fetch(`${API_BASE}/pesagens/usuario/${usuarioLogado.id}`, {
            credentials: 'include'
        });
        
        console.log('📊 Resposta recebida, status:', response.status);
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);
        
        if (response.ok) {
            renderizarHistorico(data.pesagens);
        } else {
            console.error('❌ Erro na resposta:', data);
            statsContainer.innerHTML = '<p class="error-message">Erro ao carregar estatísticas</p>';
            listaContainer.innerHTML = '<p class="error-message">Erro ao carregar histórico</p>';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error);
        statsContainer.innerHTML = '<p class="error-message">Erro ao carregar estatísticas</p>';
        listaContainer.innerHTML = '<p class="error-message">Erro ao carregar histórico</p>';
    }
}

function renderizarHistorico(pesagens) {
    console.log('📊 renderizarHistorico chamado com', pesagens?.length, 'pesagens');
    
    if (!pesagens || pesagens.length === 0) {
        console.log('⚠️ Nenhuma pesagem encontrada');
        statsContainer.innerHTML = '<p class="empty-message">Nenhuma pesagem registrada ainda.</p>';
        listaContainer.innerHTML = '';
        return;
    }
    
    console.log('✅ Renderizando', pesagens.length, 'pesagens');
    const pesoInicial = Number(pesagens[pesagens.length - 1].peso || 0);
    const pesoAtual = Number(pesagens[0].peso || 0);
    const diferenca = pesoAtual - pesoInicial;
    
    // Renderizar stats
    let statsHtml = `
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
    `;
    statsContainer.innerHTML = statsHtml;
    
    // Renderizar lista de pesagens (últimas 3)
    let listaHtml = '<div class="historico-list">';
    
    pesagens.slice(0, 3).forEach(pesagem => {
        const pesoPesagem = Number(pesagem.peso || 0);
        const data = new Date(pesagem.data_pesagem);
        const dataFormatada = data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        listaHtml += `
            <div class="historico-item">
                <div class="historico-info">
                    <span class="historico-peso">${pesoPesagem.toFixed(1)} kg</span>
                    <span class="historico-data">${dataFormatada}</span>
                </div>
                <div class="historico-actions">
                    <button class="btn-edit" onclick="editarPesagem(${pesagem.id}, ${pesoPesagem})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-delete" onclick="excluirPesagem(${pesagem.id}, ${pesoPesagem})" title="Excluir">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
    
    listaHtml += '</div>';
    listaContainer.innerHTML = listaHtml;
    
    // Equalizar alturas após renderizar o conteúdo
    setTimeout(equalizarAlturas, 50);
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

// Sistema de notificações toast
function mostrarNotificacao(mensagem, tipo = 'info', duracao = 4000) {
    // Criar container se não existir
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Criar toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    // Ícone baseado no tipo
    const icones = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icones[tipo]}</span>
        <span class="toast-message">${mensagem}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => toast.classList.add('toast-show'), 10);
    
    // Remover automaticamente
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, duracao);
}
