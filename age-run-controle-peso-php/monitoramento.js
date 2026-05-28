var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

const MONITOR_OWNER_EMAIL = 'moisescamposdelfino@gmail.com';
const FEED_POLL_MS = 4000;

let monitorSession = null;
let monitorInterval = null;
let monitorLastTs = 0;

const statusEl = document.getElementById('monitorStatus');
const totalEl = document.getElementById('kpiTotalEventos');
const ativosEl = document.getElementById('kpiAtivos');
const ultimaEl = document.getElementById('kpiUltimaAtualizacao');
const bodyEl = document.getElementById('monitorEventosBody');
const btnLogout = document.getElementById('btnLogout');

function isOwnerEmail(email) {
    return String(email || '').trim().toLowerCase() === MONITOR_OWNER_EMAIL;
}

function formatDateTimeFromUnix(tsUnix) {
    const ts = Number(tsUnix || 0);
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return d.toLocaleString('pt-BR', {
        hour12: false,
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function describeEvent(event) {
    const type = String(event?.event_type || 'api_action');
    if (type === 'login') return 'Login';
    if (type === 'logout') return 'Logout';
    if (type === 'page_access') return 'Acesso de página';
    return 'Ação API';
}

function setStatus(text) {
    if (statusEl) {
        statusEl.textContent = text;
    }
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

    if (!isOwnerEmail(data?.email)) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/home' : '/controle/home');
        return false;
    }

    monitorSession = data;
    return true;
}

function renderEvents(events) {
    if (!bodyEl) return;

    const list = Array.isArray(events) ? [...events].reverse() : [];

    if (!list.length) {
        bodyEl.innerHTML = '<tr><td colspan="5">Nenhum evento ainda.</td></tr>';
        return;
    }

    bodyEl.innerHTML = list.map((event) => {
        const ts = formatDateTimeFromUnix(event?.ts_unix);
        const nome = String(event?.user_nome || '-');
        const email = String(event?.user_email || '-');
        const method = String(event?.method || '-').toUpperCase();
        const path = String(event?.path || '-');
        const ip = String(event?.ip || '-');
        const acao = describeEvent(event);

        return `
            <tr>
                <td>${ts}</td>
                <td>${nome}<br><small>${email}</small></td>
                <td>${acao}</td>
                <td><code>${method} ${path}</code></td>
                <td>${ip}</td>
            </tr>
        `;
    }).join('');
}

function updateSummary(summary, events) {
    if (totalEl) {
        totalEl.textContent = String(summary?.total ?? events?.length ?? 0);
    }
    if (ativosEl) {
        ativosEl.textContent = String(summary?.ativos_5_min ?? 0);
    }

    const latestTs = summary?.ultima_atividade_ts || 0;
    if (ultimaEl) {
        ultimaEl.textContent = formatDateTimeFromUnix(latestTs);
    }
}

async function carregarFeed() {
    const since = Math.max(0, monitorLastTs - 2);
    const response = await fetch(`${API_BASE}/admin/monitoramento/feed?limit=200&since=${since}`, {
        credentials: 'include'
    });

    if (response.status === 401) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return;
    }

    if (response.status === 403) {
        setStatus('Acesso negado para este usuário.');
        return;
    }

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];

    if (events.length > 0) {
        monitorLastTs = Math.max(monitorLastTs, Number(events[events.length - 1]?.ts_unix || 0));
    }

    renderEvents(events);
    updateSummary(data?.summary || {}, events);

    const now = new Date();
    setStatus(`Feed ativo. Última leitura às ${now.toLocaleTimeString('pt-BR')}.`);
}

async function initMonitoramento() {
    try {
        const ok = await verificarSessao();
        if (!ok) return;

        await carregarFeed();
        monitorInterval = window.setInterval(() => {
            carregarFeed().catch((error) => {
                console.error('Erro ao atualizar feed:', error);
                setStatus('Falha ao atualizar feed em tempo real. Tentando novamente...');
            });
        }, FEED_POLL_MS);
    } catch (error) {
        console.error('Erro ao iniciar monitoramento:', error);
        setStatus('Não foi possível iniciar o monitoramento em tempo real.');
    }
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
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

window.addEventListener('beforeunload', () => {
    if (monitorInterval) {
        window.clearInterval(monitorInterval);
    }
});

document.addEventListener('DOMContentLoaded', initMonitoramento);
