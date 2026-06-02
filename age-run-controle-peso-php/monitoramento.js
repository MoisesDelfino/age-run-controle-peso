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
const resetUserSelectEl = document.getElementById('resetUserSelect');
const resetUserDropdownEl = document.getElementById('resetUserDropdown');
const resetUserIdEl = document.getElementById('resetUserId');
const btnGenerateResetEl = document.getElementById('btnGenerateReset');
const resetOutputEl = document.getElementById('resetOutput');
const resetTempPasswordEl = document.getElementById('resetTempPassword');
const resetPasswordHashEl = document.getElementById('resetPasswordHash');
const resetUpdateSqlEl = document.getElementById('resetUpdateSql');
const resetOutputNoteEl = document.getElementById('resetOutputNote');

let activeUsersState = [];
let resetUserDropdownState = {
    open: false,
    selectedIndex: 0,
    visibleUsers: []
};

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

let resultState = {
    sql: '',
    table: '',
    primaryKey: '',
    rows: [],
    columns: [],
    activeCell: null,
    savingCell: false
};

function hideResetOutput() {
    if (!resetOutputEl) return;
    resetOutputEl.hidden = true;
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function formatResetUserLabel(usuario) {
    const nome = String(usuario?.nome || 'Sem nome');
    const email = String(usuario?.email || 'sem-email');
    const ultimaPesagem = usuario?.ultima_pesagem ? ` | última pesagem: ${String(usuario.ultima_pesagem)}` : '';
    return `${nome} (${email})${ultimaPesagem}`;
}

function syncResetUserIdByInput() {
    if (!resetUserSelectEl || !resetUserIdEl) return;

    const raw = String(resetUserSelectEl.value || '').trim();
    if (!raw) {
        resetUserIdEl.value = '';
        return;
    }

    const normalizedRaw = normalizeSearchText(raw);
    const exactByLabel = activeUsersState.find((usuario) => normalizeSearchText(formatResetUserLabel(usuario)) === normalizedRaw);
    if (exactByLabel) {
        resetUserIdEl.value = String(Number(exactByLabel?.id || 0));
        return;
    }

    const sameName = activeUsersState.filter((usuario) => normalizeSearchText(usuario?.nome || '') === normalizedRaw);
    if (sameName.length === 1) {
        resetUserIdEl.value = String(Number(sameName[0]?.id || 0));
        return;
    }

    resetUserIdEl.value = '';
}

function closeResetUserDropdown() {
    if (!resetUserDropdownEl) return;
    resetUserDropdownState.open = false;
    resetUserDropdownEl.classList.remove('is-open');
}

function openResetUserDropdown() {
    if (!resetUserDropdownEl) return;
    resetUserDropdownState.open = true;
    resetUserDropdownEl.classList.add('is-open');
}

function selectResetUser(usuario) {
    if (!resetUserSelectEl || !resetUserIdEl) return;

    if (!usuario) {
        resetUserSelectEl.value = '';
        resetUserIdEl.value = '';
        closeResetUserDropdown();
        return;
    }

    resetUserSelectEl.value = formatResetUserLabel(usuario);
    resetUserIdEl.value = String(Number(usuario?.id || 0));
    closeResetUserDropdown();
}

function setResetUserDropdownSelection(index) {
    const max = resetUserDropdownState.visibleUsers.length - 1;
    if (max < 0) {
        resetUserDropdownState.selectedIndex = 0;
        return;
    }

    if (index < 0) {
        index = max;
    }
    if (index > max) {
        index = 0;
    }
    resetUserDropdownState.selectedIndex = index;

    if (!resetUserDropdownEl) return;
    const nodes = resetUserDropdownEl.querySelectorAll('.db-user-option');
    nodes.forEach((node, nodeIndex) => {
        node.classList.toggle('active', nodeIndex === resetUserDropdownState.selectedIndex);
    });
}

function renderUsuariosAtivosOptions(filterValue) {
    if (!resetUserDropdownEl) return;

    const filter = normalizeSearchText(filterValue);
    const usuariosFiltrados = activeUsersState.filter((usuario) => {
        if (!filter) return true;
        const nome = normalizeSearchText(usuario?.nome || '');
        return nome.includes(filter);
    });

    resetUserDropdownState.visibleUsers = usuariosFiltrados;
    resetUserDropdownState.selectedIndex = 0;

    if (!usuariosFiltrados.length) {
        resetUserDropdownEl.innerHTML = '<div class="db-user-option empty">Nenhum usuário encontrado</div>';
        openResetUserDropdown();
        return;
    }

    resetUserDropdownEl.innerHTML = usuariosFiltrados.map((usuario, index) => {
        const label = escapeHtml(formatResetUserLabel(usuario));
        return `<div class="db-user-option${index === 0 ? ' active' : ''}" data-index="${index}" role="option">${label}</div>`;
    }).join('');

    openResetUserDropdown();
}

function renderResetOutput(data) {
    if (!resetOutputEl) return;

    const formattedUpdateSql = String(data?.update_sql || '-')
        .replace(/\s+SET\s+/i, '\nSET ')
        .replace(/\s+WHERE\s+/i, '\nWHERE ');

    if (resetTempPasswordEl) {
        resetTempPasswordEl.textContent = String(data?.senha_temporaria || '-');
    }
    if (resetPasswordHashEl) {
        resetPasswordHashEl.textContent = String(data?.senha_hash || '-');
    }
    if (resetUpdateSqlEl) {
        resetUpdateSqlEl.textContent = formattedUpdateSql;
    }
    if (resetOutputNoteEl) {
        resetOutputNoteEl.textContent = String(data?.observacao || 'No primeiro login com a senha temporária, o usuário deverá definir uma nova senha.');
    }

    resetOutputEl.hidden = false;
}

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

function parsePrimaryTableFromSql(sql) {
    const raw = String(sql || '');
    const fromMatch = raw.match(/\bfrom\s+(["`\[]?[a-zA-Z0-9_.]+["`\]]?)/i);
    if (!fromMatch) return '';

    const token = String(fromMatch[1] || '').replace(/["`\[\]]/g, '');
    if (!token) return '';

    const parts = token.split('.').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : token;
}

function inferPrimaryKeyColumn(columns) {
    const list = Array.isArray(columns) ? columns : [];
    if (!list.length) return '';

    const exactId = list.find((col) => String(col).toLowerCase() === 'id');
    if (exactId) return exactId;

    const anyId = list.find((col) => String(col).toLowerCase().endsWith('_id'));
    return anyId || '';
}

function quoteSqlIdentifier(identifier) {
    const name = String(identifier || '').trim();
    if (!name) return '';

    if (schemaState.driver === 'pgsql' || schemaState.driver === 'postgres' || schemaState.driver === 'postgresql' || schemaState.driver === 'sqlite') {
        return `"${name.replace(/"/g, '""')}"`;
    }

    return `\`${name.replace(/`/g, '``')}\``;
}

function toSqlLiteral(value) {
    if (value === null || value === undefined) return 'NULL';

    const raw = String(value);
    if (raw.trim() === '') return "''";

    if (/^-?\d+(\.\d+)?$/.test(raw.trim())) {
        return raw.trim();
    }

    const escaped = raw.replace(/'/g, "''");
    return `'${escaped}'`;
}

function resetActiveCell() {
    resultState.activeCell = null;
}

function renderResultRows(rows, sqlSource) {
    if (!dbResultHeadEl || !dbResultBodyEl) return;

    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        dbResultHeadEl.innerHTML = '<tr><th>Resultado</th></tr>';
        dbResultBodyEl.innerHTML = '<tr><td>Query executada com sucesso, sem linhas retornadas.</td></tr>';
        resultState = {
            sql: String(sqlSource || ''),
            table: '',
            primaryKey: '',
            rows: [],
            columns: [],
            activeCell: null,
            savingCell: false
        };
        return;
    }

    const columns = Array.from(new Set(list.flatMap((row) => Object.keys(row || {}))));
    const tableName = parsePrimaryTableFromSql(sqlSource || resultState.sql);
    const primaryKey = inferPrimaryKeyColumn(columns);

    resultState.sql = String(sqlSource || resultState.sql || '');
    resultState.table = tableName;
    resultState.primaryKey = primaryKey;
    resultState.rows = list;
    resultState.columns = columns;

    const editable = Boolean(tableName && primaryKey);

    dbResultHeadEl.innerHTML = `<tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}</tr>`;
    dbResultBodyEl.innerHTML = list.map((row, rowIndex) => {
        const cells = columns.map((col) => {
            const colValue = row?.[col];
            const isPk = String(col) === String(primaryKey);
            const isEditableCell = editable && !isPk;
            const isActiveCell = Boolean(
                resultState.activeCell
                && resultState.activeCell.rowIndex === rowIndex
                && resultState.activeCell.column === col
            );

            if (isActiveCell && isEditableCell) {
                const inputValue = colValue === null || colValue === undefined ? '' : formatDbValue(colValue);
                return `<td class="db-result-cell is-editing" data-row="${rowIndex}" data-col="${escapeHtml(col)}"><input class="db-cell-input is-active" data-row="${rowIndex}" data-col="${escapeHtml(col)}" value="${escapeHtml(inputValue)}"></td>`;
            }

            const classes = ['db-result-cell'];
            if (isEditableCell) classes.push('is-editable');
            if (isPk) classes.push('is-primary-key');

            return `<td class="${classes.join(' ')}" data-row="${rowIndex}" data-col="${escapeHtml(col)}"${isEditableCell ? ' tabindex="0"' : ''}>${escapeHtml(formatDbValue(colValue))}</td>`;
        }).join('');

        return `<tr>${cells}</tr>`;
    }).join('');

    if (editable) {
        setDbResultMeta(`${Number(list.length)} linha(s) retornada(s). Clique em uma célula para editar.`);
    }
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

    if (data?.require_password_change) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/primeiro-acesso' : '/controle/primeiro-acesso');
        return false;
    }

    return true;
}

async function carregarUsuariosAtivos() {
    if (!resetUserSelectEl || !resetUserDropdownEl) return;

    const response = await fetch(`${API_BASE}/admin/query-tool/usuarios-ativos`, {
        credentials: 'include'
    });

    if (response.status === 401) {
        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return;
    }

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Falha ao carregar usuários ativos');
    }

    activeUsersState = Array.isArray(data?.usuarios) ? data.usuarios : [];
    if (!activeUsersState.length) {
        resetUserSelectEl.value = '';
        resetUserSelectEl.placeholder = 'Nenhum usuário encontrado';
        resetUserDropdownEl.innerHTML = '';
        if (resetUserIdEl) {
            resetUserIdEl.value = '';
        }
        return;
    }

    resetUserSelectEl.placeholder = 'Pesquisar e selecionar usuário...';
    renderUsuariosAtivosOptions(resetUserSelectEl.value || '');
    syncResetUserIdByInput();
}

async function gerarResetSenhaPreview() {
    syncResetUserIdByInput();
    const userId = Number(resetUserIdEl?.value || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
        setDbMessage('Selecione um usuário para gerar o reset de senha.', 'error');
        return;
    }

    setDbMessage('Gerando senha temporária...', 'info');
    hideResetOutput();

    const response = await fetch(`${API_BASE}/admin/query-tool/reset-senha-preview`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
    });

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Não foi possível gerar o reset de senha');
    }

    renderResetOutput(data);
    setDbMessage('Senha temporária e hash gerados. Execute o UPDATE sugerido para aplicar.', 'success');
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
        resetActiveCell();
        renderResultRows(data.rows, sql);
        const totalRows = Number(data.row_count || data.rows.length);
        setDbResultMeta(resultState.table && resultState.primaryKey
            ? `${totalRows} linha(s) retornada(s). Clique em uma célula para editar.`
            : `${totalRows} linha(s) retornada(s).`);
    } else {
        resetActiveCell();
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

function isExecuteShortcut(event) {
    const hasModifier = event.ctrlKey || event.metaKey;
    const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter' || event.keyCode === 13;
    return hasModifier && isEnter;
}

function isAutocompleteShortcut(event) {
    const hasModifier = event.ctrlKey || event.metaKey;
    const isSpace = event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar' || event.keyCode === 32;
    return hasModifier && isSpace;
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

function collectSuggestions(prefix, context, forceAll) {
    const normalizedPrefix = String(prefix || '').toLowerCase();
    const contextUpper = String(context || '').toUpperCase();
    const out = [];

    if (!normalizedPrefix && !forceAll) {
        return [];
    }

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

    if (!tableContext || forceAll) {
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

    if (!tableContext || forceAll) {
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

    const position = getAutocompletePosition();
    dbAutocompleteEl.style.left = `${position.left}px`;
    dbAutocompleteEl.style.top = `${position.top}px`;
    dbAutocompleteEl.style.width = `${position.width}px`;
    dbAutocompleteEl.classList.add('is-open');
}

function getAutocompletePosition() {
    if (!dbSqlEditorEl) {
        return { left: 12, top: 12, width: 320 };
    }

    const caret = getTextareaCaretCoordinates(dbSqlEditorEl, dbSqlEditorEl.selectionStart || 0);
    const editorWidth = Math.max(dbSqlEditorEl.clientWidth, 320);
    const lineHeight = Number.parseFloat(window.getComputedStyle(dbSqlEditorEl).lineHeight) || 22;
    const left = Math.min(Math.max(caret.left, 12), Math.max(12, editorWidth - 332));

    return {
        left,
        top: caret.top + lineHeight + 6,
        width: Math.min(320, Math.max(220, editorWidth - left - 12))
    };
}

function getTextareaCaretCoordinates(textarea, position) {
    const mirror = document.createElement('div');
    const computed = window.getComputedStyle(textarea);
    const properties = [
        'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth',
        'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight',
        'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing'
    ];

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';

    properties.forEach((property) => {
        mirror.style[property] = computed[property];
    });

    mirror.textContent = textarea.value.slice(0, position);

    const marker = document.createElement('span');
    marker.textContent = textarea.value.slice(position, position + 1) || ' ';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const left = marker.offsetLeft - textarea.scrollLeft + Number.parseFloat(computed.borderLeftWidth) + Number.parseFloat(computed.paddingLeft);
    const top = marker.offsetTop - textarea.scrollTop + Number.parseFloat(computed.borderTopWidth) + Number.parseFloat(computed.paddingTop);

    document.body.removeChild(mirror);
    return {
        left: Math.max(12, left),
        top: Math.max(12, top)
    };
}

function hideAutocomplete() {
    autocompleteState.open = false;
    autocompleteState.items = [];
    autocompleteState.selectedIndex = 0;
    renderAutocomplete();
}

function updateAutocompleteSuggestions(forceAll) {
    if (!dbSqlEditorEl) return;

    const tokenInfo = getCurrentTokenInfo();
    if (!tokenInfo) return;

    autocompleteState.tokenStart = tokenInfo.start;
    autocompleteState.tokenEnd = tokenInfo.end;

    const token = tokenInfo.token || '';
    const items = collectSuggestions(token, tokenInfo.context, Boolean(forceAll));

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

function focusActiveCellInput() {
    const input = dbResultBodyEl?.querySelector('.db-cell-input.is-active');
    if (!input) return;

    input.focus();
    input.select();
}

function openCellEditor(rowIndex, column) {
    if (resultState.savingCell) return;

    const row = resultState.rows[rowIndex];
    if (!row || !column || String(column) === String(resultState.primaryKey)) return;

    resultState.activeCell = { rowIndex, column };
    renderResultRows(resultState.rows, resultState.sql);
    focusActiveCellInput();
}

function cancelActiveCellEdit() {
    if (!resultState.activeCell) return;
    resetActiveCell();
    renderResultRows(resultState.rows, resultState.sql);
}

function getActiveCellInput() {
    return dbResultBodyEl?.querySelector('.db-cell-input.is-active') || null;
}

async function saveActiveCellEdit() {
    if (resultState.savingCell || !resultState.activeCell) return;

    const activeCell = resultState.activeCell;
    const input = getActiveCellInput();
    const row = resultState.rows[activeCell.rowIndex];
    if (!row) {
        resetActiveCell();
        return;
    }

    const table = resultState.table;
    const pk = resultState.primaryKey;
    if (!table || !pk) {
        setDbMessage('Esta query não suporta edição inline automática.', 'error');
        return;
    }

    const nextValue = input ? input.value : '';
    const originalValue = row[activeCell.column];
    const comparableOriginal = originalValue === null || originalValue === undefined ? '' : String(originalValue);
    if (nextValue === comparableOriginal) {
        resetActiveCell();
        renderResultRows(resultState.rows, resultState.sql);
        return;
    }

    const normalizedValue = nextValue === '' && (originalValue === null || originalValue === undefined)
        ? null
        : nextValue;
    const sql = `UPDATE ${quoteSqlIdentifier(table)} SET ${quoteSqlIdentifier(activeCell.column)} = ${toSqlLiteral(normalizedValue)} WHERE ${quoteSqlIdentifier(pk)} = ${toSqlLiteral(row[pk])}`;

    try {
        resultState.savingCell = true;
        setDbMessage('Salvando alteração...', 'info');

        const response = await fetch(`${API_BASE}/admin/db-query`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql })
        });

        const data = await response.json();
        if (!response.ok || data?.error) {
            throw new Error(data?.error || 'Falha ao salvar edição');
        }

        setDbMessage('Campo atualizado com sucesso.', 'success');
        resetActiveCell();
        await executarSqlDb();
    } catch (error) {
        setDbMessage(error.message || 'Falha ao salvar edição.', 'error');
    } finally {
        resultState.savingCell = false;
    }
}

function bindResultEditingEvents() {
    if (!dbResultBodyEl) return;

    dbResultBodyEl.addEventListener('click', (event) => {
        const cell = event.target.closest('.db-result-cell.is-editable');
        if (!cell) return;

        const rowIndex = Number(cell.getAttribute('data-row'));
        const column = String(cell.getAttribute('data-col') || '');
        if (Number.isFinite(rowIndex) && column) {
            openCellEditor(rowIndex, column);
        }
    });

    dbResultBodyEl.addEventListener('keydown', (event) => {
        if (event.target.classList.contains('db-cell-input')) {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveActiveCellEdit();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                cancelActiveCellEdit();
            }
            return;
        }

        const cell = event.target.closest('.db-result-cell.is-editable');
        if (!cell) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const rowIndex = Number(cell.getAttribute('data-row'));
            const column = String(cell.getAttribute('data-col') || '');
            if (Number.isFinite(rowIndex) && column) {
                openCellEditor(rowIndex, column);
            }
        }
    });

    dbResultBodyEl.addEventListener('focusout', (event) => {
        if (!event.target.classList.contains('db-cell-input')) return;
        if (resultState.savingCell) return;
        saveActiveCellEdit();
    });
}

function bindAutocompleteEvents() {
    if (!dbSqlEditorEl || !dbAutocompleteEl) return;

    dbSqlEditorEl.addEventListener('input', () => {
        updateAutocompleteSuggestions();
    });

    dbSqlEditorEl.addEventListener('click', () => {
        hideAutocomplete();
    });

    dbSqlEditorEl.addEventListener('keydown', (event) => {
        if (isExecuteShortcut(event)) {
            event.preventDefault();
            executarSqlDb().catch((error) => {
                console.error('Erro ao executar SQL:', error);
                setDbMessage(error.message || 'Falha ao executar SQL.', 'error');
                setDbResultMeta('Erro ao executar query.');
            });
            return;
        }

        if (isAutocompleteShortcut(event)) {
            event.preventDefault();
            updateAutocompleteSuggestions(true);
            if (!autocompleteState.open) {
                setDbMessage('Sem sugestões para o contexto atual.', 'info');
            }
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

    if (resetUserSelectEl) {
        resetUserSelectEl.addEventListener('input', () => {
            renderUsuariosAtivosOptions(resetUserSelectEl.value || '');
            if (resetUserIdEl) {
                resetUserIdEl.value = '';
            }
            hideResetOutput();
        });

        resetUserSelectEl.addEventListener('change', () => {
            syncResetUserIdByInput();
            closeResetUserDropdown();
            hideResetOutput();
        });

        resetUserSelectEl.addEventListener('focus', () => {
            renderUsuariosAtivosOptions(resetUserSelectEl.value || '');
        });

        resetUserSelectEl.addEventListener('keydown', (event) => {
            if (!resetUserDropdownState.open) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setResetUserDropdownSelection(resetUserDropdownState.selectedIndex + 1);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setResetUserDropdownSelection(resetUserDropdownState.selectedIndex - 1);
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                closeResetUserDropdown();
                return;
            }

            if (event.key === 'Enter') {
                const selectedUser = resetUserDropdownState.visibleUsers[resetUserDropdownState.selectedIndex];
                if (selectedUser) {
                    event.preventDefault();
                    selectResetUser(selectedUser);
                    hideResetOutput();
                }
            }
        });
    }

    if (resetUserDropdownEl) {
        resetUserDropdownEl.addEventListener('mousedown', (event) => {
            const option = event.target.closest('.db-user-option');
            if (!option || option.classList.contains('empty')) return;

            event.preventDefault();
            const index = Number(option.getAttribute('data-index') || 0);
            const user = resetUserDropdownState.visibleUsers[index];
            if (!user) return;

            selectResetUser(user);
            hideResetOutput();
        });

        document.addEventListener('click', (event) => {
            if (!resetUserDropdownEl.contains(event.target) && event.target !== resetUserSelectEl) {
                closeResetUserDropdown();
            }
        });
    }

    if (btnGenerateResetEl) {
        btnGenerateResetEl.addEventListener('click', () => {
            gerarResetSenhaPreview().catch((error) => {
                console.error('Erro ao gerar reset de senha:', error);
                setDbMessage(error.message || 'Falha ao gerar reset de senha.', 'error');
            });
        });
    }

    bindAutocompleteEvents();
    bindResultEditingEvents();
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
        await carregarUsuariosAtivos();
        setDbResultMeta('Pronto para executar queries.');
        setDbMessage('Console SQL pronto. Use Ctrl+Enter para executar.', 'info');
    } catch (error) {
        console.error('Erro ao iniciar Query Tool:', error);
        setDbMessage(error.message || 'Não foi possível iniciar a Query Tool.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', initPage);
