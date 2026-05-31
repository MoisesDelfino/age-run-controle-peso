var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

const MONITOR_OWNER_EMAIL = 'moisescamposdelfino@gmail.com';
const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT JOIN',
    'RIGHT JOIN', 'INNER JOIN', 'ON', 'AND', 'OR', 'IN', 'NOT IN', 'IS NULL',
    'IS NOT NULL', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
    'SHOW TABLES', 'DESCRIBE', 'PRAGMA table_info', 'WITH'
];

const btnLogout = document.getElementById('btnLogout');
const dbDriverLabel = document.getElementById('dbDriverLabel');
const dbTablesCountLabel = document.getElementById('dbTablesCountLabel');
const dbSchemaListEl = document.getElementById('dbSchemaList');
const dbTableSelectEl = document.getElementById('dbTableSelect');
const dbSqlEditorEl = document.getElementById('dbSqlEditor');
const dbToolMessageEl = document.getElementById('dbToolMessage');
const dbResultMetaEl = document.getElementById('dbResultMeta');
const dbResultHeadEl = document.getElementById('dbResultHead');
const dbResultBodyEl = document.getElementById('dbResultBody');
const dbAutocompleteEl = document.getElementById('dbAutocomplete');
const btnRunSql = document.getElementById('btnRunSql');
const btnRefreshSchema = document.getElementById('btnRefreshSchema');
const btnLoadTableSql = document.getElementById('btnLoadTableSql');

let schemaState = {
    driver: '-',
    tables: [],
    columnsByTable: {}
};

let autocompleteState = {
    items: [],
    selectedIndex: 0,
    open: false,
    tokenStart: 0,
    tokenEnd: 0
};

function isOwnerEmail(email) {
    return String(email || '').trim().toLowerCase() === MONITOR_OWNER_EMAIL;
}

function setDbMessage(text, type) {
    if (!dbToolMessageEl) return;
    dbToolMessageEl.textContent = text || '';
    dbToolMessageEl.className = type ? `db-message ${type} show` : 'db-message';
}

function setDbResultMeta(text) {
    if (dbResultMetaEl) {
        dbResultMetaEl.textContent = text;
    }
}

function formatDbValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }
    return String(value);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeColumnName(column) {
    return String(
        column.column_name ||
        column.name ||
        column.Field ||
        column.cid ||
        ''
    ).trim();
}

function normalizeColumnType(column) {
    return String(
        column.data_type ||
        column.type ||
        column.Type ||
        ''
    ).trim();
}

function renderDbSchema(driver, tables, schemas) {
    schemaState.driver = driver || '-';
    schemaState.tables = Array.isArray(tables) ? tables : [];
    schemaState.columnsByTable = {};

    schemaState.tables.forEach((table) => {
        const cols = Array.isArray(schemas?.[table]) ? schemas[table] : [];
        schemaState.columnsByTable[table] = cols
            .map((c) => normalizeColumnName(c))
            .filter((name) => name !== '');
    });

    if (dbDriverLabel) {
        dbDriverLabel.textContent = `Driver: ${schemaState.driver}`;
    }

    if (dbTablesCountLabel) {
        dbTablesCountLabel.textContent = `Tabelas: ${schemaState.tables.length}`;
    }

    if (dbTableSelectEl) {
        dbTableSelectEl.innerHTML = schemaState.tables.length
            ? schemaState.tables.map((table) => `<option value="${escapeHtml(table)}">${escapeHtml(table)}</option>`).join('')
            : '<option value="">Nenhuma tabela encontrada</option>';
    }

    if (!dbSchemaListEl) return;

    if (!schemaState.tables.length) {
        dbSchemaListEl.innerHTML = '<div class="db-schema-card"><p class="db-caption">Nenhuma tabela encontrada.</p></div>';
        return;
    }

    dbSchemaListEl.innerHTML = schemaState.tables.map((table) => {
        const cols = Array.isArray(schemas?.[table]) ? schemas[table] : [];

        const colList = cols.length
            ? `<ul class="db-schema-columns">${cols.map((col) => {
                const name = normalizeColumnName(col) || 'coluna';
                const type = normalizeColumnType(col);
                const nullable = String(col.is_nullable || '').trim();
                const key = String(col.column_key || col.Key || '').trim();
                const parts = [type, nullable, key].filter(Boolean).map((part) => escapeHtml(part));
                return `<li><strong>${escapeHtml(name)}</strong>${parts.length ? ` - ${parts.join(' - ')}` : ''}</li>`;
            }).join('')}</ul>`
            : '<p class="db-caption">Sem colunas detectadas.</p>';

        return `<div class="db-schema-card"><h4>${escapeHtml(table)}</h4>${colList}</div>`;
    }).join('');
}

function renderResultRows(rows) {
    if (!dbResultHeadEl || !dbResultBodyEl) return;

    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        dbResultHeadEl.innerHTML = '<tr><th>Resultado</th></tr>';
        dbResultBodyEl.innerHTML = '<tr><td>Query executada com sucesso, sem linhas retornadas.</td></tr>';
        return;
    }

    const columns = Array.from(new Set(list.flatMap((row) => Object.keys(row || {}))));

    dbResultHeadEl.innerHTML = `<tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}</tr>`;
    dbResultBodyEl.innerHTML = list.map((row) => {
        return `<tr>${columns.map((col) => `<td>${escapeHtml(formatDbValue(row?.[col]))}</td>`).join('')}</tr>`;
    }).join('');
}

function renderResultAffected(affectedRows) {
    if (!dbResultHeadEl || !dbResultBodyEl) return;
    dbResultHeadEl.innerHTML = '<tr><th>Resultado</th></tr>';
    dbResultBodyEl.innerHTML = `<tr><td>${Number(affectedRows || 0)} linha(s) afetada(s).</td></tr>`;
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

    return true;
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
        throw new Error(data?.error || 'Falha ao carregar estrutura do banco');
    }

    renderDbSchema(data?.driver || '-', data?.tables || [], data?.schemas || {});
    updateAutocompleteSuggestions();
    setDbMessage('Schema atualizado.', 'success');
}

function buildSelectSql(tableName) {
    if (!tableName) return '';
    return `SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT 50;`;
}

async function executarSqlDb() {
    const sql = String(dbSqlEditorEl?.value || '').trim();
    if (!sql) {
        setDbMessage('Digite uma query SQL para executar.', 'error');
        return;
    }

    hideAutocomplete();
    setDbMessage('Executando query...', 'info');
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
        renderResultRows(data.rows);
        setDbResultMeta(`${Number(data.row_count || data.rows.length)} linha(s) retornada(s).`);
    } else {
        renderResultAffected(data?.affected_rows || 0);
        setDbResultMeta(`${Number(data?.affected_rows || 0)} linha(s) afetada(s).`);
        await carregarEstruturaDb();
    }

    setDbMessage('Query executada com sucesso.', 'success');
}

function getCurrentTokenInfo() {
    if (!dbSqlEditorEl) return null;

    const text = dbSqlEditorEl.value;
    const caret = dbSqlEditorEl.selectionStart;
    let start = caret;
    let end = caret;

    while (start > 0 && /[a-zA-Z0-9_.]/.test(text[start - 1])) {
        start -= 1;
    }

    while (end < text.length && /[a-zA-Z0-9_.]/.test(text[end])) {
        end += 1;
    }

    const token = text.slice(start, caret);
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const context = text.slice(lineStart, start).toUpperCase();

    return { token, start, end, context };
}

function dedupeSuggestions(items) {
    const map = new Map();
    items.forEach((item) => {
        const key = `${item.type}::${item.value}`;
        if (!map.has(key)) {
            map.set(key, item);
        }
    });
    return Array.from(map.values());
}

function collectSuggestions(prefix, context) {
    const normalizedPrefix = String(prefix || '').toLowerCase();
    const contextUpper = String(context || '').toUpperCase();
    const out = [];

    const tableContext = /(FROM|JOIN|UPDATE|INTO|TABLE|DESCRIBE|TRUNCATE)\s*$/i.test(contextUpper);

    if (normalizedPrefix.includes('.')) {
        const [tablePart, columnPart] = normalizedPrefix.split('.', 2);
        const table = schemaState.tables.find((t) => t.toLowerCase() === tablePart);
        if (table) {
            (schemaState.columnsByTable[table] || []).forEach((column) => {
                if (!columnPart || column.toLowerCase().startsWith(columnPart)) {
                    out.push({ label: `${table}.${column}`, value: `${table}.${column}`, type: 'column' });
                }
            });
        }
        return dedupeSuggestions(out).slice(0, 12);
    }

    if (!tableContext) {
        SQL_KEYWORDS.forEach((keyword) => {
            if (!normalizedPrefix || keyword.toLowerCase().startsWith(normalizedPrefix)) {
                out.push({ label: keyword, value: keyword, type: 'keyword' });
            }
        });
    }

    schemaState.tables.forEach((table) => {
        if (!normalizedPrefix || table.toLowerCase().startsWith(normalizedPrefix)) {
            out.push({ label: table, value: table, type: 'table' });
        }
    });

    if (!tableContext) {
        Object.entries(schemaState.columnsByTable).forEach(([table, columns]) => {
            columns.forEach((column) => {
                if (!normalizedPrefix || column.toLowerCase().startsWith(normalizedPrefix)) {
                    out.push({ label: `${column} (${table})`, value: column, type: 'column' });
                }
            });
        });
    }

    return dedupeSuggestions(out)
        .sort((a, b) => {
            const aStarts = a.value.toLowerCase().startsWith(normalizedPrefix) ? 0 : 1;
            const bStarts = b.value.toLowerCase().startsWith(normalizedPrefix) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.value.localeCompare(b.value);
        })
        .slice(0, 12);
}

function renderAutocomplete() {
    if (!dbAutocompleteEl) return;

    if (!autocompleteState.open || !autocompleteState.items.length) {
        dbAutocompleteEl.classList.remove('is-open');
        dbAutocompleteEl.innerHTML = '';
        return;
    }

    dbAutocompleteEl.innerHTML = autocompleteState.items.map((item, index) => {
        const activeClass = index === autocompleteState.selectedIndex ? ' active' : '';
        return `
            <div class="db-autocomplete-item${activeClass}" data-index="${index}">
                <span>${escapeHtml(item.label)}</span>
                <span class="db-autocomplete-type">${escapeHtml(item.type)}</span>
            </div>
        `;
    }).join('');

    dbAutocompleteEl.classList.add('is-open');
}

function hideAutocomplete() {
    autocompleteState.open = false;
    autocompleteState.items = [];
    autocompleteState.selectedIndex = 0;
    renderAutocomplete();
}

function updateAutocompleteSuggestions() {
    if (!dbSqlEditorEl) return;

    const tokenInfo = getCurrentTokenInfo();
    if (!tokenInfo) return;

    autocompleteState.tokenStart = tokenInfo.start;
    autocompleteState.tokenEnd = tokenInfo.end;

    const token = tokenInfo.token || '';
    const items = collectSuggestions(token, tokenInfo.context);

    if (!items.length) {
        hideAutocomplete();
        return;
    }

    autocompleteState.items = items;
    autocompleteState.selectedIndex = 0;
    autocompleteState.open = true;
    renderAutocomplete();
}

function selectAutocompleteIndex(index) {
    if (!autocompleteState.items.length) return;

    const max = autocompleteState.items.length - 1;
    if (index < 0) index = max;
    if (index > max) index = 0;

    autocompleteState.selectedIndex = index;
    renderAutocomplete();
}

function applyAutocompleteItem(item) {
    if (!dbSqlEditorEl || !item) return;

    const text = dbSqlEditorEl.value;
    const before = text.slice(0, autocompleteState.tokenStart);
    const after = text.slice(autocompleteState.tokenEnd);
    const insertValue = item.value;

    const nextText = `${before}${insertValue}${after}`;
    dbSqlEditorEl.value = nextText;

    const caret = before.length + insertValue.length;
    dbSqlEditorEl.focus();
    dbSqlEditorEl.setSelectionRange(caret, caret);

    hideAutocomplete();
}

function bindAutocompleteEvents() {
    if (!dbSqlEditorEl || !dbAutocompleteEl) return;

    dbSqlEditorEl.addEventListener('input', () => {
        updateAutocompleteSuggestions();
    });

    dbSqlEditorEl.addEventListener('click', () => {
        updateAutocompleteSuggestions();
    });

    dbSqlEditorEl.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            executarSqlDb().catch((error) => {
                console.error('Erro ao executar SQL:', error);
                setDbMessage(error.message || 'Falha ao executar SQL.', 'error');
                setDbResultMeta('Erro ao executar query.');
            });
            return;
        }

        if (!autocompleteState.open) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectAutocompleteIndex(autocompleteState.selectedIndex + 1);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectAutocompleteIndex(autocompleteState.selectedIndex - 1);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            hideAutocomplete();
            return;
        }

        if (event.key === 'Tab' || event.key === 'Enter') {
            event.preventDefault();
            applyAutocompleteItem(autocompleteState.items[autocompleteState.selectedIndex]);
        }
    });

    dbAutocompleteEl.addEventListener('mousedown', (event) => {
        const target = event.target.closest('.db-autocomplete-item');
        if (!target) return;

        event.preventDefault();
        const index = Number(target.dataset.index || 0);
        applyAutocompleteItem(autocompleteState.items[index]);
    });

    document.addEventListener('click', (event) => {
        if (!dbAutocompleteEl.contains(event.target) && event.target !== dbSqlEditorEl) {
            hideAutocomplete();
        }
    });
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
            updateAutocompleteSuggestions();
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
            updateAutocompleteSuggestions();
        });
    }

    bindAutocompleteEvents();
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

async function initPage() {
    try {
        const ok = await verificarSessao();
        if (!ok) return;

        initDbTool();
        await carregarEstruturaDb();
        setDbResultMeta('Pronto para executar queries.');
        setDbMessage('Console SQL pronto. Use Ctrl+Enter para executar.', 'info');
    } catch (error) {
        console.error('Erro ao iniciar Query Tool:', error);
        setDbMessage(error.message || 'Não foi possível iniciar a Query Tool.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', initPage);
