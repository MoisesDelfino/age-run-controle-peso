var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

const perfilForm = document.getElementById('perfilForm');
const perfilMessage = document.getElementById('perfilMessage');
const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilSexo = document.getElementById('perfilSexo');
const perfilAltura = document.getElementById('perfilAltura');
const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
const btnLogout = document.getElementById('btnLogout');

function showMessage(text, type) {
    if (!perfilMessage) return;
    perfilMessage.textContent = text || '';
    perfilMessage.className = type ? `perfil-message ${type} show` : 'perfil-message';
}

async function carregarPerfil() {
    const response = await fetch(`${API_BASE}/usuario/perfil`, { credentials: 'include' });
    if (response.status === 401) {
        const base = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
        window.location.href = `${base}/login`;
        return;
    }
    if (!response.ok) {
        showMessage('Não foi possível carregar seus dados.', 'error');
        return;
    }
    const data = await response.json();
    if (perfilNome) perfilNome.value = data.nome || '';
    if (perfilEmail) perfilEmail.value = data.email || '';
    if (perfilSexo) perfilSexo.value = (data.sexo || 'masculino').toLowerCase();
    if (perfilAltura) perfilAltura.value = data.altura != null ? String(data.altura) : '';
}

if (perfilForm) {
    perfilForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (btnSalvarPerfil) btnSalvarPerfil.disabled = true;
        showMessage('', '');

        const nome = (perfilNome?.value || '').trim();
        const sexo = perfilSexo?.value || '';
        const alturaRaw = (perfilAltura?.value || '').trim();
        const altura = alturaRaw !== '' ? Number(alturaRaw) : null;

        if (!nome) {
            showMessage('O nome é obrigatório.', 'error');
            if (btnSalvarPerfil) btnSalvarPerfil.disabled = false;
            return;
        }

        try {
            const body = { nome, sexo };
            if (altura !== null && !Number.isNaN(altura)) body.altura = altura;

            const response = await fetch(`${API_BASE}/usuario/perfil`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (!response.ok || data?.error) {
                throw new Error(data?.error || 'Erro ao salvar perfil.');
            }

            showMessage('Perfil atualizado com sucesso!', 'success');
        } catch (err) {
            showMessage(err.message || 'Erro ao salvar.', 'error');
        } finally {
            if (btnSalvarPerfil) btnSalvarPerfil.disabled = false;
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
        } finally {
            const base = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
            window.location.href = `${base}/login`;
        }
    });
}

async function initPage() {
    try {
        const sessionRes = await fetch(`${API_BASE}/auth/session`, { credentials: 'include' });
        const session = await sessionRes.json();
        if (!session?.authenticated) {
            const base = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
            window.location.href = `${base}/login`;
            return;
        }
        if (session?.require_password_change) {
            const base = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
            window.location.href = `${base}/primeiro-acesso`;
            return;
        }
        await carregarPerfil();
    } catch (err) {
        showMessage('Erro ao carregar página.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', initPage);
