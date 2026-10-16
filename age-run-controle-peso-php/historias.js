(function initHistorias() {
    const API_BASE = window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api';
    const APP_BASE = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
    const feed = document.getElementById('historiasFeed');
    const formCard = document.getElementById('historiaFormCard');
    const form = document.getElementById('historiaForm');
    const message = document.getElementById('historiaMensagem');
    let historiasAtuais = new Map();

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
        historiasAtuais = new Map(historias.map((historia) => [String(historia.id), historia]));
        if (!historias.length) {
            feed.innerHTML = '<div class="historias-empty"><span class="material-icons">auto_stories</span><strong>O mural está esperando a primeira história.</strong><p>Que tal começar compartilhando a sua?</p></div>';
            return;
        }
        feed.innerHTML = historias.map((historia) => {
            const id = String(historia.id);
            const liked = Boolean(historia.curtiu);
            const likes = Number(historia.curtidas) || 0;
            const photo = historia.foto_perfil
                ? `<img src="${escapeHtml(historia.foto_perfil)}" alt="">`
                : `<span>${escapeHtml(historia.identificado ? initials(historia.autor) : '•')}</span>`;
            return `<article class="historia-card" data-historia-id="${escapeHtml(id)}">
                <header class="historia-post-header">
                    <div class="historia-avatar${historia.identificado ? '' : ' is-anonymous'}">${photo}</div>
                    <div class="historia-post-author"><strong>${escapeHtml(historia.autor)}</strong><span><time>${escapeHtml(formatDate(historia.criado_em))}</time><span aria-hidden="true">·</span><span class="material-icons" aria-label="Publicação visível para a comunidade">public</span></span></div>
                    ${historia.identificado ? '' : '<span class="historia-anonymous-badge">Anônima</span>'}
                </header>
                <div class="historia-post-body">
                    ${historia.titulo ? `<h3>${escapeHtml(historia.titulo)}</h3>` : ''}
                    <p>${escapeHtml(historia.conteudo).replace(/\n/g, '<br>')}</p>
                </div>
                <div class="historia-post-actions" aria-label="Ações da publicação">
                    <button type="button" class="historia-social-action historia-like-button${liked ? ' is-active' : ''}" aria-label="Curtir história" aria-pressed="${liked}"><span class="material-icons">${liked ? 'favorite' : 'favorite_border'}</span></button>
                    <button type="button" class="historia-social-action historia-share-button" aria-label="Compartilhar história"><span class="material-icons">send</span></button>
                </div>
                <div class="historia-like-count" aria-live="polite">${likes === 1 ? '1 curtida' : `${likes} curtidas`}</div>
            </article>`;
        }).join('');
    };
    const load = async () => {
        feed.innerHTML = '<div class="loading">Carregando histórias...</div>';
        try { render((await request('/historias')).historias || []); }
        catch (error) { feed.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
    };

    document.getElementById('abrirHistoriaForm')?.addEventListener('click', () => { formCard.hidden = false; formCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('historiaTitulo')?.focus({ preventScroll: true }); });
    document.getElementById('fecharHistoriaForm')?.addEventListener('click', () => { formCard.hidden = true; showMessage(''); });
    document.getElementById('atualizarHistorias')?.addEventListener('click', load);
    feed?.addEventListener('click', async (event) => {
        const card = event.target.closest('[data-historia-id]');
        const button = event.target.closest('.historia-social-action');
        if (!card || !button) return;
        const id = card.dataset.historiaId;
        if (button.classList.contains('historia-like-button')) {
            if (button.disabled) return;
            button.disabled = true;
            try {
                const data = await request(`/historias/${encodeURIComponent(id)}/curtir`, { method: 'POST' });
                button.classList.toggle('is-active', data.curtiu);
                button.setAttribute('aria-pressed', String(data.curtiu));
                button.querySelector('.material-icons').textContent = data.curtiu ? 'favorite' : 'favorite_border';
                const counter = card.querySelector('.historia-like-count');
                if (counter) counter.textContent = data.curtidas === 1 ? '1 curtida' : `${data.curtidas} curtidas`;
            } catch (error) {
                showMessage(error.message, 'error');
            } finally {
                button.disabled = false;
            }
        }
        if (button.classList.contains('historia-share-button')) {
            const historia = historiasAtuais.get(id);
            const shareData = { title: historia?.titulo || 'História Age Run', text: historia?.conteudo || '', url: window.location.href };
            try {
                if (navigator.share) await navigator.share(shareData);
                else {
                    await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`);
                    const icon = button.querySelector('.material-icons');
                    icon.textContent = 'check';
                    window.setTimeout(() => { icon.textContent = 'send'; }, 1600);
                }
            } catch (error) {
                if (error?.name !== 'AbortError') console.warn('Não foi possível compartilhar a história.', error);
            }
        }
    });
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
