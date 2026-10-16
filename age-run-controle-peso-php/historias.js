(function initHistorias() {
    const API_BASE = window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api';
    const APP_BASE = window.location.pathname.startsWith('/dev') ? '/dev' : '/controle';
    const feed = document.getElementById('historiasFeed');
    const formCard = document.getElementById('historiaFormCard');
    const form = document.getElementById('historiaForm');
    const message = document.getElementById('historiaMensagem');
    let historiasAtuais = new Map();
    let historiaEmEdicao = null;

    const openComposer = (historia = null) => {
        historiaEmEdicao = historia?.id ? String(historia.id) : null;
        document.getElementById('historiaFormTitulo').textContent = historiaEmEdicao ? 'Editar história' : 'Nova história';
        document.getElementById('historiaFormDescricao').textContent = historiaEmEdicao ? 'Atualize o texto ou a forma de identificação.' : 'Você pode publicar quantas histórias quiser.';
        document.getElementById('historiaSubmitTexto').textContent = historiaEmEdicao ? 'Salvar alterações' : 'Publicar história';
        document.getElementById('historiaConteudo').value = historia?.conteudo || '';
        document.getElementById('historiaIdentificada').checked = historia ? Boolean(historia.identificado) : true;
        formCard.hidden = false;
        document.body.classList.add('historia-compose-open');
        window.setTimeout(() => document.getElementById('historiaConteudo')?.focus({ preventScroll: true }), 50);
    };
    const closeComposer = () => {
        formCard.hidden = true;
        document.body.classList.remove('historia-compose-open');
        historiaEmEdicao = null;
        showMessage('');
    };

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
    const confirmDelete = () => new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'historia-delete-modal';
        modal.innerHTML = `<div class="historia-delete-backdrop"></div><section role="alertdialog" aria-modal="true" aria-labelledby="historiaDeleteTitle"><span class="material-icons historia-delete-icon">delete_outline</span><h2 id="historiaDeleteTitle">Excluir história?</h2><p>Esta publicação e suas curtidas serão removidas permanentemente.</p><div><button type="button" class="btn btn-secondary" data-delete-answer="cancel">Cancelar</button><button type="button" class="btn btn-danger" data-delete-answer="confirm">Excluir</button></div></section>`;
        const finish = (answer) => {
            modal.remove();
            document.body.classList.remove('historia-delete-open');
            resolve(answer);
        };
        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-delete-answer="confirm"]')) finish(true);
            if (event.target.closest('[data-delete-answer="cancel"]') || event.target.classList.contains('historia-delete-backdrop')) finish(false);
        });
        document.body.appendChild(modal);
        document.body.classList.add('historia-delete-open');
        modal.querySelector('[data-delete-answer="cancel"]').focus();
    });
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
                    ${historia.propria ? `<details class="historia-owner-menu"><summary aria-label="Opções da história"><span class="material-icons">more_horiz</span></summary><div><button type="button" class="historia-edit-button"><span class="material-icons">edit</span>Editar</button><button type="button" class="historia-delete-button"><span class="material-icons">delete_outline</span>Excluir</button></div></details>` : ''}
                </header>
                <div class="historia-post-body">
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

    document.getElementById('abrirHistoriaForm')?.addEventListener('click', () => openComposer());
    document.getElementById('fecharHistoriaForm')?.addEventListener('click', closeComposer);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !formCard.hidden) closeComposer();
    });
    document.getElementById('atualizarHistorias')?.addEventListener('click', load);
    feed?.addEventListener('click', async (event) => {
        const card = event.target.closest('[data-historia-id]');
        const button = event.target.closest('button');
        if (!card || !button) return;
        const id = card.dataset.historiaId;
        const historia = historiasAtuais.get(id);
        if (button.classList.contains('historia-edit-button')) {
            openComposer(historia);
            return;
        }
        if (button.classList.contains('historia-delete-button')) {
            const confirmed = await confirmDelete();
            if (!confirmed) return;
            button.disabled = true;
            try {
                await request(`/historias/${encodeURIComponent(id)}`, { method: 'DELETE' });
                await load();
            } catch (error) {
                button.disabled = false;
                feed.insertAdjacentHTML('afterbegin', `<div class="error-message">${escapeHtml(error.message)}</div>`);
            }
            return;
        }
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
            const shareData = { title: 'História Age Run', text: historia?.conteudo || '', url: window.location.href };
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
            const endpoint = historiaEmEdicao ? `/historias/${encodeURIComponent(historiaEmEdicao)}` : '/historias';
            const data = await request(endpoint, { method: historiaEmEdicao ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                conteudo: document.getElementById('historiaConteudo').value,
                identificado: document.getElementById('historiaIdentificada').checked,
            }) });
            form.reset();
            document.getElementById('historiaIdentificada').checked = true;
            await load();
            closeComposer();
        } catch (error) { showMessage(error.message, 'error'); }
        finally { submit.disabled = false; }
    });
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        window.location.href = `${APP_BASE}/login`;
    });
    load();
})();
