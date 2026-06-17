var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

const MONITOR_OWNER_EMAIL = 'moisescamposdelfino@gmail.com';
const REFRESH_INTERVAL_MS = 30000;

const btnLogout = document.getElementById('btnLogout');
const btnRefreshAccess = document.getElementById('btnRefreshAccess');
const accessTotalLabel = document.getElementById('accessTotalLabel');
const accessLastUpdateLabel = document.getElementById('accessLastUpdateLabel');
const accessMessage = document.getElementById('accessMessage');
const accessTableBody = document.getElementById('accessTableBody');

let refreshTimerId = null;

function isOwnerEmail(email) {
    return String(email || '').trim().toLowerCase() === MONITOR_OWNER_EMAIL;
}

function showMessage(text, type) {
    if (!accessMessage) return;
    accessMessage.textContent = text || '';
    accessMessage.className = type ? `access-message ${type} show` : 'access-message';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(tsUnix, tsIso) {
    if (Number.isFinite(Number(tsUnix)) && Number(tsUnix) > 0) {
        return new Date(Number(tsUnix) * 1000).toLocaleString('pt-BR');
    }

    if (tsIso) {
        const date = new Date(tsIso);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString('pt-BR');
        }
    }

    return '-';
}

function formatEventType(eventType) {
    const normalized = String(eventType || '').toLowerCase().trim();
    if (normalized === 'login') return 'Login';
    if (normalized === 'logout') return 'Logout';
    if (normalized === 'page_access') return 'Acesso pagina';
    if (normalized === 'api_action') return 'Acao API';
    if (normalized === 'pwa_installed') return 'PWA instalado';
    return normalized || 'evento';
}

function renderAccessRows(events) {
    if (!accessTableBody) return;

    const list = Array.isArray(events) ? [...events].reverse() : [];
    if (!list.length) {
        accessTableBody.innerHTML = '<tr><td colspan="6">Nenhum acesso encontrado.</td></tr>';
        return;
    }

    accessTableBody.innerHTML = list.map((event) => {
        const eventType = String(event?.event_type || 'evento').toLowerCase();
        const method = String(event?.method || '-').toUpperCase();
        const userName = String(event?.user_nome || '-');
        const userEmail = String(event?.user_email || '-');
        const path = String(event?.path || '-');
        const ip = String(event?.ip || '-');
        const dateText = formatDate(event?.ts_unix, event?.ts_iso);

        return `
            <tr>
                <td>${escapeHtml(dateText)}</td>
                <td>
                    <strong>${escapeHtml(userName)}</strong><br>
                    <span class="access-muted">${escapeHtml(userEmail)}</span>
                </td>
                <td><span class="access-badge ${escapeHtml(eventType)}">${escapeHtml(formatEventType(eventType))}</span></td>
                <td>${escapeHtml(method)}</td>
                <td>${escapeHtml(path)}</td>
                <td>${escapeHtml(ip)}</td>
            </tr>
        `;
    }).join('');
}

async function verificarSessao() {
    const response = await fetch(`${API_BASE}/auth/session`, {
        credentials: 'include'
    });

    const data = await response.json();

    if (!data?.authenticated) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return false;
    }

    if (data?.require_password_change) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/primeiro-acesso' : '/controle/primeiro-acesso');
        return false;
    }

    if (!isOwnerEmail(data?.email)) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/home' : '/controle/home');
        return false;
    }

    return true;
}

async function carregarUltimosAcessos() {
    const response = await fetch(`${API_BASE}/admin/monitoramento/feed?limit=200`, {
        credentials: 'include'
    });

    if (response.status === 401) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return;
    }

    if (response.status === 403) {
        showMessage('Acesso restrito ao administrador.', 'error');
        return;
    }

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Falha ao carregar ultimos acessos');
    }

    const events = Array.isArray(data?.events) ? data.events : [];
    renderAccessRows(events);

    if (accessTotalLabel) {
        accessTotalLabel.textContent = `Eventos: ${events.length}`;
    }

    if (accessLastUpdateLabel) {
        accessLastUpdateLabel.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-BR')}`;
    }

    showMessage('Historico de acessos atualizado.', 'success');
}

function iniciarAutoRefresh() {
    if (refreshTimerId) {
        clearInterval(refreshTimerId);
    }

    refreshTimerId = setInterval(() => {
        carregarUltimosAcessos().catch((error) => {
            console.error('Erro ao atualizar acessos:', error);
            showMessage(error.message || 'Falha ao atualizar acessos.', 'error');
        });
    }, REFRESH_INTERVAL_MS);
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } finally {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
    }
}

if (btnLogout) {
    btnLogout.addEventListener('click', (event) => {
        event.preventDefault();
        handleLogout();
    });
}

if (btnRefreshAccess) {
    btnRefreshAccess.addEventListener('click', () => {
        carregarUltimosAcessos().catch((error) => {
            console.error('Erro ao atualizar acessos:', error);
            showMessage(error.message || 'Falha ao atualizar acessos.', 'error');
        });
    });
}

// ==================== NOVOS USUÁRIOS ====================

let pendingDescartarId = null;

const newUsersSection = document.getElementById('newUsersSection');
const newUsersList = document.getElementById('newUsersList');
const newUsersBadge = document.getElementById('newUsersBadge');
const descartarModal = document.getElementById('descartarModal');
const descartarModalText = document.getElementById('descartarModalText');
const btnCancelDescartar = document.getElementById('btnCancelDescartar');
const btnConfirmDescartar = document.getElementById('btnConfirmDescartar');

function formatCadastroDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR');
}

function renderNovosUsuarios(usuarios) {
    if (!newUsersList || !newUsersSection || !newUsersBadge) return;

    if (!Array.isArray(usuarios) || usuarios.length === 0) {
        newUsersSection.style.display = 'none';
        return;
    }

    newUsersSection.style.display = 'block';
    newUsersBadge.textContent = String(usuarios.length);

    newUsersList.innerHTML = usuarios.map((u) => {
        const nome = escapeHtml(String(u.nome || '-'));
        const email = escapeHtml(String(u.email || '-'));
        const sexo = escapeHtml(String(u.sexo || '-'));
        const dataCadastro = escapeHtml(formatCadastroDate(u.data_cadastro));
        const uid = Number(u.id || 0);
        return `<div class="new-user-item">
            <div class="new-user-info">
                <strong>${nome}</strong>
                <span>${email} · ${sexo} · Cadastro: ${dataCadastro}</span>
            </div>
            <button class="btn-descartar" type="button" data-uid="${uid}" data-nome="${nome}">Descartar</button>
        </div>`;
    }).join('');

    newUsersList.querySelectorAll('.btn-descartar').forEach((btn) => {
        btn.addEventListener('click', () => {
            const uid = Number(btn.dataset.uid);
            const nome = btn.dataset.nome || 'este usuário';
            pendingDescartarId = uid;
            if (descartarModalText) {
                descartarModalText.textContent = `Tem certeza que deseja descartar "${nome}" da lista de novos?`;
            }
            if (descartarModal) descartarModal.classList.add('show');
        });
    });
}

async function carregarNovosUsuarios() {
    try {
        const response = await fetch(`${API_BASE}/admin/novos-usuarios`, { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        renderNovosUsuarios(Array.isArray(data?.novos_usuarios) ? data.novos_usuarios : []);
    } catch (e) {
        console.error('Erro ao carregar novos usuários:', e);
    }
}

async function descartarNovoUsuario(uid) {
    const response = await fetch(`${API_BASE}/admin/novos-usuarios/${uid}/descartar`, {
        method: 'POST',
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Falha ao descartar usuário');
    await carregarNovosUsuarios();
}

if (btnCancelDescartar) {
    btnCancelDescartar.addEventListener('click', () => {
        pendingDescartarId = null;
        if (descartarModal) descartarModal.classList.remove('show');
    });
}

if (descartarModal) {
    descartarModal.addEventListener('click', (e) => {
        if (e.target === descartarModal) {
            pendingDescartarId = null;
            descartarModal.classList.remove('show');
        }
    });
}

if (btnConfirmDescartar) {
    btnConfirmDescartar.addEventListener('click', async () => {
        if (!pendingDescartarId) return;
        const uid = pendingDescartarId;
        pendingDescartarId = null;
        if (descartarModal) descartarModal.classList.remove('show');
        try {
            await descartarNovoUsuario(uid);
        } catch (e) {
            showMessage(e.message || 'Erro ao descartar usuário.', 'error');
        }
    });
}

// ==================== INIT ====================

async function initPage() {
    try {
        const ok = await verificarSessao();
        if (!ok) return;

        await Promise.all([carregarUltimosAcessos(), carregarNovosUsuarios()]);
        iniciarAutoRefresh();
    } catch (error) {
        console.error('Erro ao iniciar pagina de acessos:', error);
        showMessage(error.message || 'Nao foi possivel iniciar a pagina.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', initPage);
