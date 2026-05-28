// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api')));

var usuarioLogado = usuarioLogado || null;

const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');
const rpForm = document.getElementById('rpForm');
const rpMessage = document.getElementById('rpMessage');
const rpPaceSummary = document.getElementById('rpPaceSummary');
const groupSameLevel = document.getElementById('groupSameLevel');
const groupHigherLevel = document.getElementById('groupHigherLevel');
const groupLowerLevel = document.getElementById('groupLowerLevel');
const groupsNotice = document.getElementById('groupsNotice');
const welcomeSection = document.querySelector('.welcome-section');

const statusBadgeMap = {
    rp_5k_status: document.getElementById('statusRp5k'),
    rp_10k_status: document.getElementById('statusRp10k'),
    rp_21k_status: document.getElementById('statusRp21k'),
    rp_42k_status: document.getElementById('statusRp42k')
};

document.addEventListener('DOMContentLoaded', async () => {
    const ok = await verificarSessao();
    if (ok) {
        await carregarRps();
        await carregarGruposTreino();
    }
});

function getStatusText(status) {
    if (status === 'pendente') return 'Aguardando aprovação';
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    return 'Sem RP';
}

function getStatusClass(status) {
    if (status === 'pendente') return 'status-pendente';
    if (status === 'aprovado') return 'status-aprovado';
    if (status === 'reprovado') return 'status-reprovado';
    return 'status-sem-rp';
}

function renderRpStatuses(data) {
    const entries = [
        ['rp_5k_status', data.rp_5k_status, data.rp_5k],
        ['rp_10k_status', data.rp_10k_status, data.rp_10k],
        ['rp_21k_status', data.rp_21k_status, data.rp_21k],
        ['rp_42k_status', data.rp_42k_status, data.rp_42k]
    ];

    entries.forEach(([statusKey, statusValue, rpValue]) => {
        const badge = statusBadgeMap[statusKey];
        if (!badge) return;

        const normalizedStatus = rpValue === null || rpValue === undefined
            ? null
            : (statusValue || 'pendente');

        badge.className = `rp-status-badge ${getStatusClass(normalizedStatus)}`;
        badge.textContent = getStatusText(normalizedStatus);
    });
}

async function verificarSessao(tentativas = 3) {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.authenticated) {
            if (tentativas > 0) {
                await new Promise(resolve => setTimeout(resolve, 400));
                return verificarSessao(tentativas - 1);
            }

            window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            return false;
        }

        usuarioLogado = data;
        const primeiroNome = usuarioLogado.nome?.split(' ')[0] || '';
        if (userNameSpan) {
            userNameSpan.textContent = primeiroNome;
        }

        return true;
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        if (tentativas > 0) {
            await new Promise(resolve => setTimeout(resolve, 400));
            return verificarSessao(tentativas - 1);
        }

        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return false;
    }
}

function showRpMessage(texto, tipo = 'info') {
    if (!rpMessage) return;
    rpMessage.textContent = texto;
    rpMessage.className = `message ${tipo}`;
    rpMessage.style.display = 'block';

    setTimeout(() => {
        rpMessage.style.display = 'none';
    }, 5000);
}

function fillRpInputs(data) {
    const map = [
        ['rp5k', data.rp_5k_formatado],
        ['rp10k', data.rp_10k_formatado],
        ['rp21k', data.rp_21k_formatado],
        ['rp42k', data.rp_42k_formatado]
    ];

    map.forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) {
            input.value = value || '';
        }
    });

    if (rpPaceSummary) {
        rpPaceSummary.textContent = data.ritmo_medio_formatado
            ? `Seu ritmo médio estimado: ${data.ritmo_medio_formatado}`
            : '';
    }

    const rp5kSeconds = Number(data?.rp_5k);
    const hasRp5k = Number.isFinite(rp5kSeconds) && rp5kSeconds > 0;
    if (welcomeSection) {
        welcomeSection.style.display = hasRp5k ? 'none' : '';
    }

    renderRpStatuses(data);
}

async function carregarRps() {
    try {
        const response = await fetch(`${API_BASE}/performance/rps`, {
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar RPs');
        }

        fillRpInputs(data);
    } catch (error) {
        console.error('Erro ao carregar RPs:', error);
    }
}

function renderGroupList(container, itens) {
    if (!container) return;

    if (!itens || !itens.length) {
        container.innerHTML = '<p class="group-empty">Nenhum atleta encontrado para este grupo.</p>';
        return;
    }

    container.innerHTML = itens.map((item) => {
        const diff = Number(item.diferenca_percentual || 0);
        const sinal = diff > 0 ? '+' : '';
        return `
            <div class="group-item">
                <strong>${item.nome}</strong>
                <div class="group-meta">Ritmo médio: ${item.ritmo_medio_formatado || '-'}</div>
                <div class="group-meta">Diferença vs você: ${sinal}${diff.toFixed(2)}%</div>
            </div>
        `;
    }).join('');
}

async function carregarGruposTreino() {
    try {
        const response = await fetch(`${API_BASE}/performance/grupos`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar grupos');
        }

        if (groupsNotice) {
            if (data.aviso) {
                groupsNotice.textContent = data.aviso;
            } else if (data.meu_nivel?.ritmo_medio_formatado) {
                groupsNotice.textContent = `Seu ritmo médio atual: ${data.meu_nivel.ritmo_medio_formatado}`;
            } else {
                groupsNotice.textContent = '';
            }
        }

        renderGroupList(groupSameLevel, data.grupos?.mesmo_nivel || []);
        renderGroupList(groupHigherLevel, data.grupos?.nivel_mais_alto || []);
        renderGroupList(groupLowerLevel, data.grupos?.nivel_mais_baixo || []);
    } catch (error) {
        console.error('Erro ao carregar grupos:', error);
        if (groupsNotice) {
            groupsNotice.textContent = 'Não foi possível carregar os grupos de treino.';
        }
    }
}

async function salvarRps(event) {
    event.preventDefault();

    const payload = {
        rp_5k: document.getElementById('rp5k')?.value?.trim() || null,
        rp_10k: document.getElementById('rp10k')?.value?.trim() || null,
        rp_21k: document.getElementById('rp21k')?.value?.trim() || null,
        rp_42k: document.getElementById('rp42k')?.value?.trim() || null
    };

    try {
        const response = await fetch(`${API_BASE}/performance/rps`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao salvar RPs');
        }

        showRpMessage('✅ Recordes pessoais salvos com sucesso!', 'success');
        if (data.rps) {
            fillRpInputs(data.rps);
        }
        await carregarGruposTreino();
    } catch (error) {
        console.error('Erro ao salvar RPs:', error);
        showRpMessage(`❌ ${error.message}`, 'error');
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
                window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            }, 100);
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

if (rpForm) {
    rpForm.addEventListener('submit', salvarRps);
}
