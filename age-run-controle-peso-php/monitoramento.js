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
const instaladosEl = document.getElementById('kpiInstalados');
const bodyEl = document.getElementById('monitorEventosBody');
const installedBodyEl = document.getElementById('monitorInstaladosBody');
const btnLogout = document.getElementById('btnLogout');
const dbDriverLabel = document.getElementById('dbDriverLabel');
const dbTablesCountLabel = document.getElementById('dbTablesCountLabel');
const dbSchemaListEl = document.getElementById('dbSchemaList');
const dbTableSelectEl = document.getElementById('dbTableSelect');
const dbSqlEditorEl = document.getElementById('dbSqlEditor');
const dbToolMessageEl = document.getElementById('dbToolMessage');
const dbResultMetaEl = document.getElementById('dbResultMeta');
const dbResultBodyEl = document.getElementById('dbResultBody');
const btnRunSql = document.getElementById('btnRunSql');
const btnRefreshSchema = document.getElementById('btnRefreshSchema');
const btnLoadTableSql = document.getElementById('btnLoadTableSql');

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

function formatDbValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }
    if (typeof value === 'string' && value.trim() === '') return '-';
    return String(value);
}

function setDbMessage(text, type = '') {
    if (!dbToolMessageEl) return;
    dbToolMessageEl.textContent = text;
    dbToolMessageEl.className = type ? `message ${type} show` : 'message';
}

function setDbResultMeta(text) {
    if (dbResultMetaEl) {
        dbResultMetaEl.textContent = text;
    }
}

function renderDbSchema(driver, tables, schemas) {
    if (dbDriverLabel) {
        dbDriverLabel.textContent = `Driver: ${driver || '-'}`;
    }
    if (dbTablesCountLabel) {
        dbTablesCountLabel.textContent = `Tabelas: ${Array.isArray(tables) ? tables.length : 0}`;
    }
    if (dbTableSelectEl) {
        const list = Array.isArray(tables) ? tables : [];
        dbTableSelectEl.innerHTML = list.length
            ? list.map((table) => `<option value="${table}">${table}</option>`).join('')
            : '<option value="">Nenhuma tabela encontrada</option>';
    }

    if (!dbSchemaListEl) return;
    const list = Array.isArray(tables) ? tables : [];
    if (!list.length) {
        dbSchemaListEl.innerHTML = '<div class="db-schema-card"><p class="monitor-status">Nenhuma tabela encontrada.</p></div>';
        return;
    }

    dbSchemaListEl.innerHTML = list.map((table) => {
        const columns = Array.isArray(schemas?.[table]) ? schemas[table] : [];
        const columnHtml = columns.length
            ? `<ul class="db-schema-columns">${columns.map((column) => {
                const name = column.column_name || column.name || column.Field || column.cid || 'coluna';
                const type = column.data_type || column.type || column.Type || '';
                const nullable = column.is_nullable || '';
                const key = column.column_key || column.Key || '';
                return `<li><strong>${formatDbValue(name)}</strong>${type ? ` - ${formatDbValue(type)}` : ''}${nullable ? ` - ${formatDbValue(nullable)}` : ''}${key ? ` - ${formatDbValue(key)}` : ''}</li>`;
            }).join('')}</ul>`
            : '<p class="monitor-status">Sem colunas detalhadas.</p>';

        return `
            <div class="db-schema-card">
                <h4>${table}</h4>
                ${columnHtml}
            </div>
        `;
    }).join('');
}

function renderDbRows(rows) {
    if (!dbResultBodyEl) return;

    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        dbResultBodyEl.innerHTML = '<tr><td>Query executada com sucesso, mas sem linhas retornadas.</td></tr>';
        return;
    }

    const columns = Array.from(new Set(list.flatMap((row) => Object.keys(row || {}))));
    if (!columns.length) {
        dbResultBodyEl.innerHTML = '<tr><td>Query executada, mas sem colunas detectáveis.</td></tr>';
        return;
    }

    dbResultBodyEl.innerHTML = `
        <tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>
        ${list.map((row) => `
            <tr>${columns.map((column) => `<td>${formatDbValue(row?.[column])}</td>`).join('')}</tr>
        `).join('')}
    `;
}

async function carregarEstruturaDb() {
    const response = await fetch(`${API_BASE}/admin/db-structure`, {
        credentials: 'include'
    });

    if (response.status === 401) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return;
    }

    if (response.status === 403) {
        setDbMessage('Acesso negado para esta área.', 'error');
        return;
    }

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Falha ao carregar schema do banco');
    }

    renderDbSchema(data?.driver || '-', data?.tables || [], data?.schemas || {});
    setDbMessage('Schema carregado.', 'success');
}

function buildSelectSql(tableName) {
    if (!tableName) return '';
    return `SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT 50;`;
}

async function executarSqlDb() {
    const sql = String(dbSqlEditorEl?.value || '').trim();
    if (!sql) {
        setDbMessage('Digite uma query SQL.', 'error');
        return;
    }

    setDbMessage('Executando query...', '');
    setDbResultMeta('Processando query...');

    const response = await fetch(`${API_BASE}/admin/db-query`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
    });

    if (response.status === 401) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return;
    }

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || `Falha ao executar query (HTTP ${response.status})`);
    }

    if (Array.isArray(data?.rows)) {
        renderDbRows(data.rows);
        setDbResultMeta(`${data.row_count ?? data.rows.length} linha(s) retornada(s).`);
    } else {
        if (dbResultBodyEl) {
            dbResultBodyEl.innerHTML = `<tr><td>${data?.affected_rows ?? 0} linha(s) afetada(s).</td></tr>`;
        }
        setDbResultMeta(`${data?.affected_rows ?? 0} linha(s) afetada(s).`);
    }

    setDbMessage('Query executada com sucesso.', 'success');
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

function renderInstalledUsers(installedUsers) {
    if (!installedBodyEl) return;

    const list = Array.isArray(installedUsers) ? installedUsers : [];
    if (!list.length) {
        installedBodyEl.innerHTML = '<tr><td colspan="5">Nenhuma instalação registrada.</td></tr>';
        return;
    }

    installedBodyEl.innerHTML = list.map((item) => {
        const nome = String(item?.user_nome || '-');
        const email = String(item?.user_email || '-');
        const instaladoEm = formatDateTimeFromUnix(item?.installed_at_unix);
        const plataforma = String(item?.last_platform || '-').toUpperCase();
        const detectadoPor = String(item?.install_detected_by || '-');
        const ultimaAtividade = formatDateTimeFromUnix(item?.last_seen_unix);

        return `
            <tr>
                <td>${nome}<br><small>${email}</small></td>
                <td>${instaladoEm}</td>
                <td>${plataforma}</td>
                <td>${detectadoPor}</td>
                <td>${ultimaAtividade}</td>
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

    if (instaladosEl) {
        instaladosEl.textContent = String(summary?.instalados_total ?? 0);
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
    const installedUsers = Array.isArray(data?.installed_users) ? data.installed_users : [];

    if (events.length > 0) {
        monitorLastTs = Math.max(monitorLastTs, Number(events[events.length - 1]?.ts_unix || 0));
    }

    renderEvents(events);
    renderInstalledUsers(installedUsers);
    updateSummary(data?.summary || {}, events);

    const now = new Date();
    setStatus(`Feed ativo. Última leitura às ${now.toLocaleTimeString('pt-BR')}.`);
}

function initDbTool() {
    if (btnRefreshSchema) {
        btnRefreshSchema.addEventListener('click', () => {
            carregarEstruturaDb().catch((error) => {
                console.error('Erro ao carregar schema:', error);
                setDbMessage(error.message || 'Falha ao carregar schema.', 'error');
            });
        });
    }

    if (btnLoadTableSql) {
        btnLoadTableSql.addEventListener('click', () => {
            const tableName = String(dbTableSelectEl?.value || '').trim();
            if (!tableName || !dbSqlEditorEl) return;
            dbSqlEditorEl.value = buildSelectSql(tableName);
            setDbMessage(`Query montada para ${tableName}.`, 'success');
        });
    }

    if (btnRunSql) {
        btnRunSql.addEventListener('click', () => {
            executarSqlDb().catch((error) => {
                console.error('Erro ao executar SQL:', error);
                setDbMessage(error.message || 'Falha ao executar SQL.', 'error');
                setDbResultMeta('Erro ao executar query.');
            });
        });
    }

    if (dbTableSelectEl) {
        dbTableSelectEl.addEventListener('change', () => {
            const tableName = String(dbTableSelectEl.value || '').trim();
            if (!tableName || !dbSqlEditorEl) return;
            dbSqlEditorEl.value = buildSelectSql(tableName);
        });
    }
}

async function initMonitoramento() {
    try {
        const ok = await verificarSessao();
        if (!ok) return;

        initDbTool();
        await carregarEstruturaDb();
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
