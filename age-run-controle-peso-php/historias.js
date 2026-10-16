(function initHistorias() {
    const API_BASE = window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api';
    const APP_BASE = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
    const feed = document.getElementById('historiasFeed');
    const formCard = document.getElementById('historiaFormCard');
    const form = document.getElementById('historiaForm');
    const message = document.getElementById('historiaMensagem');

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const formatDate = (value) => {
        const date = new Date(String(value || '').replace(' ', 'T'));
        return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };
    const initials = (name) => String(name || 'A').split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
    const showMessage = (text, type = 'success') => {
        message.textContent = text;
        message.className = `message ${type}`;
        message.style.display = text ? 'block' : 'none';
    };
    const request = async (path, options = {}) => {
        const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            window.location.href = `${APP_BASE}/login`;
            throw new Error('Sessão expirada.');
        }
        if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
        return data;
    };
    const render = (historias) => {
        if (!historias.length) {
            feed.innerHTML = '<div class="historias-empty"><span class="material-icons">auto_stories</span><strong>O mural está esperando a primeira história.</strong><p>Que tal começar compartilhando a sua?</p></div>';
            return;
        }
        feed.innerHTML = historias.map((historia) => {
            const photo = historia.foto_perfil
                ? `<img src="${escapeHtml(historia.foto_perfil)}" alt="">`
                : `<span>${escapeHtml(historia.identificado ? initials(historia.autor) : '•')}</span>`;
            return `<article class="historia-card">
                <header><div class="historia-avatar${historia.identificado ? '' : ' is-anonymous'}">${photo}</div><div><strong>${escapeHtml(historia.autor)}</strong><time>${escapeHtml(formatDate(historia.criado_em))}</time></div></header>
                ${historia.titulo ? `<h3>${escapeHtml(historia.titulo)}</h3>` : ''}
                <p>${escapeHtml(historia.conteudo).replace(/\n/g, '<br>')}</p>
            </article>`;
        }).join('');
    };
    const load = async () => {
        feed.innerHTML = '<div class="loading">Carregando histórias...</div>';
        try { render((await request('/historias')).historias || []); }
        catch (error) { feed.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
    };

    document.getElementById('abrirHistoriaForm')?.addEventListener('click', () => { formCard.hidden = false; formCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    document.getElementById('fecharHistoriaForm')?.addEventListener('click', () => { formCard.hidden = true; showMessage(''); });
    document.getElementById('atualizarHistorias')?.addEventListener('click', load);
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        showMessage('');
        try {
            const data = await request('/historias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                titulo: document.getElementById('historiaTitulo').value,
                conteudo: document.getElementById('historiaConteudo').value,
                identificado: document.getElementById('historiaIdentificada').checked,
            }) });
            form.reset();
            document.getElementById('historiaIdentificada').checked = true;
            showMessage(data.message || 'História publicada.');
            await load();
        } catch (error) { showMessage(error.message, 'error'); }
        finally { submit.disabled = false; }
    });
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        window.location.href = `${APP_BASE}/login`;
    });
    load();
})();
