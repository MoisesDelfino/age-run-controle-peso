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
    const storyUrl = (token) => {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('h', String(token));
        return url.toString();
    };
    const wrapCanvasText = (context, text, maxWidth) => {
        const paragraphs = String(text || '').split(/\n/);
        const lines = [];
        paragraphs.forEach((paragraph) => {
            const words = paragraph.split(/\s+/).filter(Boolean);
            let line = '';
            words.forEach((word) => {
                const candidate = line ? `${line} ${word}` : word;
                if (line && context.measureText(candidate).width > maxWidth) {
                    lines.push(line);
                    line = word;
                } else line = candidate;
            });
            if (line) lines.push(line);
            if (!words.length) lines.push('');
        });
        return lines;
    };
    const loadCanvasImage = (source) => new Promise((resolve) => {
        if (!source) return resolve(null);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = source;
    });
    const roundedRect = (context, x, y, width, height, radius) => {
        const r = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.arcTo(x + width, y, x + width, y + height, r);
        context.arcTo(x + width, y + height, x, y + height, r);
        context.arcTo(x, y + height, x, y, r);
        context.arcTo(x, y, x + width, y, r);
        context.closePath();
    };
    const createStoryCard = async (historia) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const context = canvas.getContext('2d');
        const [logo, avatar] = await Promise.all([
            loadCanvasImage(new URL('logo.png', window.location.href).toString()),
            historia.foto_perfil ? loadCanvasImage(new URL(historia.foto_perfil, window.location.origin).toString()) : Promise.resolve(null),
        ]);
        const gradient = context.createLinearGradient(0, 0, 1080, 1350);
        gradient.addColorStop(0, '#121212');
        gradient.addColorStop(0.58, '#1b151f');
        gradient.addColorStop(1, '#28112f');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1080, 1350);

        const glow = context.createRadialGradient(960, 120, 20, 960, 120, 520);
        glow.addColorStop(0, 'rgba(142, 32, 181, 0.42)');
        glow.addColorStop(1, 'rgba(142, 32, 181, 0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, 1080, 700);
        context.fillStyle = '#8bc34a';
        context.fillRect(0, 0, 1080, 22);

        if (logo) {
            const logoWidth = 210;
            const logoHeight = logo.height * (logoWidth / logo.width);
            context.drawImage(logo, 72, 70, logoWidth, logoHeight);
        } else {
            context.font = '700 64px Poppins, sans-serif';
            context.fillText('age run', 72, 128);
        }

        context.fillStyle = 'rgba(139, 195, 74, 0.14)';
        roundedRect(context, 330, 78, 330, 54, 27);
        context.fill();
        context.fillStyle = '#bce881';
        context.font = '700 23px Poppins, sans-serif';
        context.fillText('HISTÓRIAS AGE RUN', 356, 114);

        context.fillStyle = 'rgba(255, 255, 255, 0.055)';
        roundedRect(context, 60, 180, 960, 1100, 44);
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        context.lineWidth = 2;
        context.stroke();

        context.save();
        context.beginPath();
        context.arc(142, 285, 54, 0, Math.PI * 2);
        context.clip();
        if (avatar && historia.identificado) {
            const scale = Math.max(108 / avatar.width, 108 / avatar.height);
            const width = avatar.width * scale;
            const height = avatar.height * scale;
            context.drawImage(avatar, 142 - width / 2, 285 - height / 2, width, height);
        } else if (!historia.identificado) {
            context.fillStyle = '#4b4f54';
            context.fillRect(88, 231, 108, 108);
            context.fillStyle = '#c7cacf';
            context.beginPath();
            context.arc(142, 270, 19, 0, Math.PI * 2);
            context.fill();
            context.beginPath();
            context.arc(142, 326, 39, Math.PI, 0);
            context.lineTo(181, 339);
            context.lineTo(103, 339);
            context.closePath();
            context.fill();
        } else {
            context.fillStyle = '#34203d';
            context.fillRect(88, 231, 108, 108);
            context.fillStyle = '#c785da';
            context.font = '700 36px Poppins, sans-serif';
            context.textAlign = 'center';
            context.fillText(initials(historia.autor), 142, 298);
            context.textAlign = 'left';
        }
        context.restore();
        context.strokeStyle = historia.identificado ? '#8bc34a' : '#858b91';
        context.lineWidth = 6;
        context.beginPath();
        context.arc(142, 285, 57, 0, Math.PI * 2);
        context.stroke();

        context.fillStyle = '#d7f4af';
        context.font = '700 34px Poppins, sans-serif';
        context.fillText(historia.autor || 'História anônima', 225, 278);
        context.fillStyle = '#bdb8c0';
        context.font = '400 23px Poppins, sans-serif';
        context.fillText(formatDate(historia.criado_em), 225, 317);

        context.fillStyle = 'rgba(139, 195, 74, 0.22)';
        context.font = '700 100px Georgia, serif';
        context.fillText('“', 92, 465);
        context.fillStyle = '#ffffff';
        context.font = '500 36px Poppins, sans-serif';
        const lines = wrapCanvasText(context, historia.conteudo, 820).slice(0, 11);
        if (wrapCanvasText(context, historia.conteudo, 820).length > 11 && lines.length) lines[10] = `${lines[10].replace(/[.,;:]?$/, '')}…`;
        lines.forEach((line, index) => context.fillText(line, 130, 475 + (index * 57)));

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
        return blob ? new File([blob], 'historia-age-run.png', { type: 'image/png' }) : null;
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
                : historia.identificado
                    ? `<span>${escapeHtml(initials(historia.autor))}</span>`
                    : '<span class="material-icons" aria-hidden="true">person</span>';
            return `<article id="historia-${escapeHtml(id)}" class="historia-card" data-historia-id="${escapeHtml(id)}">
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
        try {
            const historias = (await request('/historias')).historias || [];
            const shareToken = new URLSearchParams(window.location.search).get('h');
            let requestedId = null;
            if (shareToken) {
                try {
                    const sharedStory = (await request(`/historias/compartilhada/${encodeURIComponent(shareToken)}`)).historia;
                    requestedId = String(sharedStory.id);
                    if (!historias.some((historia) => String(historia.id) === requestedId)) historias.unshift(sharedStory);
                } catch (error) { /* Mantém o mural disponível. */ }
            }
            render(historias);
            if (requestedId) window.setTimeout(() => {
                const target = document.getElementById(`historia-${requestedId}`);
                target?.classList.add('is-linked-story');
                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
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
            if (button.disabled) return;
            button.disabled = true;
            const { token } = await request(`/historias/${encodeURIComponent(id)}/link`, { method: 'POST' });
            const directUrl = storyUrl(token);
            const shareData = { text: directUrl };
            try {
                const cardFile = await createStoryCard(historia);
                if (navigator.share && cardFile && navigator.canShare?.({ files: [cardFile] })) {
                    await navigator.share({ ...shareData, files: [cardFile] });
                } else if (navigator.share) await navigator.share(shareData);
                else {
                    await navigator.clipboard.writeText(directUrl);
                    const icon = button.querySelector('.material-icons');
                    icon.textContent = 'check';
                    window.setTimeout(() => { icon.textContent = 'send'; }, 1600);
                }
            } catch (error) {
                if (error?.name !== 'AbortError') console.warn('Não foi possível compartilhar a história.', error);
            } finally {
                button.disabled = false;
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
