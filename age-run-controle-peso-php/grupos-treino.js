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
        if (usuarioLogado?.perfil === 'treinador' || usuarioLogado?.email === 'moisescamposdelfino@gmail.com') {
            await carregarAdminGrupos();
        }
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

function normalizeStr(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderAdminGrupos(grupos, filtro) {
    const container = document.getElementById('adminGruposList');
    if (!container) return;
    const q = normalizeStr(filtro);

    let html = '';
    let grupoIdx = 0;

    for (const grupo of grupos) {
        const atletasFiltrados = q
            ? grupo.atletas.filter((a) => normalizeStr(a.nome).includes(q) || normalizeStr(a.email).includes(q))
            : grupo.atletas;
        if (!atletasFiltrados.length) continue;
        grupoIdx++;

        html += `
            <div class="admin-grupo-card" style="margin-bottom:1rem;padding:1rem;border-radius:10px;border:1px solid var(--border-color,#334155)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
                    <strong>Grupo ${grupoIdx}</strong>
                    <span class="group-meta">Ritmo ref: ${grupo.ritmo_medio_formatado} &bull; ${atletasFiltrados.length} atleta(s)</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:.35rem">
                    ${atletasFiltrados.map((a) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem .5rem;border-radius:6px;background:var(--card-bg-alt,#1e293b)">
                            <span>${a.nome}</span>
                            <span class="group-meta">${a.ritmo_medio_formatado}&nbsp;<small style="opacity:.6">${a.fonte === 'teste' ? '🧪 teste' : '📋 RP'}</small></span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (!html) {
        html = q
            ? `<p class="group-empty">Nenhum atleta encontrado para "${filtro}".</p>`
            : '<p class="group-empty">Nenhum atleta com RP aprovado encontrado.</p>';
    }

    container.innerHTML = html;
}

async function carregarAdminGrupos() {
    const section = document.getElementById('adminGruposSection');
    if (!section) return;

    try {
        const response = await fetch(`${API_BASE}/admin/todos-grupos`, { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.grupos) return;

        section.style.display = '';
        renderAdminGrupos(data.grupos, '');

        const searchInput = document.getElementById('adminGruposSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderAdminGrupos(data.grupos, searchInput.value);
            });
        }
    } catch (e) {
        console.error('Erro ao carregar admin grupos:', e);
    }
}

function parseRpToSeconds(value) {
    if (!value) return null;
    const parts = value.trim().split(':').map(Number);
    if (parts.some(isNaN) || parts.length < 2) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
}

function secondsToPaceDisplay(totalSeconds, distKm) {
    if (!totalSeconds || !distKm) return '–';
    const paceSeconds = totalSeconds / distKm;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.round(paceSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} /km`;
}

let _rpConfirmPayload = null;

function salvarRps(event) {
    event.preventDefault();

    const fields = [
        { id: 'rp5k',  key: 'rp_5k',  label: '5 km',              dist: 5 },
        { id: 'rp10k', key: 'rp_10k', label: '10 km',             dist: 10 },
        { id: 'rp21k', key: 'rp_21k', label: 'Meia Maratona (21k)', dist: 21.0975 },
        { id: 'rp42k', key: 'rp_42k', label: 'Maratona (42k)',     dist: 42.195 }
    ];

    const payload = {};

    const tbody = document.getElementById('rpConfirmTableBody');
    if (tbody) tbody.innerHTML = '';

    fields.forEach(({ id, key, label, dist }) => {
        const raw = document.getElementById(id)?.value?.trim() || null;
        payload[key] = raw || null;

        const secs = parseRpToSeconds(raw);
        const paceDisplay = secs ? secondsToPaceDisplay(secs, dist) : '–';

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${label}</td><td>${raw || '–'}</td><td>${paceDisplay}</td>`;
            tbody.appendChild(tr);
        }
    });

    _rpConfirmPayload = payload;
    const modal = document.getElementById('rpConfirmModal');
    if (modal) modal.style.display = 'flex';
}

async function executarSalvarRps() {
    if (!_rpConfirmPayload) return;
    const payload = _rpConfirmPayload;
    _rpConfirmPayload = null;

    const modal = document.getElementById('rpConfirmModal');
    if (modal) modal.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE}/performance/rps`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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

document.getElementById('rpConfirmOk')?.addEventListener('click', executarSalvarRps);

document.getElementById('rpConfirmCancel')?.addEventListener('click', () => {
    _rpConfirmPayload = null;
    const modal = document.getElementById('rpConfirmModal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('rpConfirmModal')?.querySelector('.rp-confirm-backdrop')?.addEventListener('click', () => {
    _rpConfirmPayload = null;
    const modal = document.getElementById('rpConfirmModal');
    if (modal) modal.style.display = 'none';
});
