var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

const perfilForm = document.getElementById('perfilForm');
const perfilMessage = document.getElementById('perfilMessage');
const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilSexo = document.getElementById('perfilSexo');
const perfilAltura = document.getElementById('perfilAltura');
const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
const btnLogout = document.getElementById('btnLogout');
const garminCard = document.getElementById('garminCard');
const btnConectarGarmin = document.getElementById('btnConectarGarmin');
const garminSecurityNote = document.getElementById('garminSecurityNote');
const garminChecks = document.getElementById('garminChecks');
const garminStatusText = document.getElementById('garminStatusText');
const garminLoginForm = document.getElementById('garminLoginForm');
const garminEmail = document.getElementById('garminEmail');
const garminPassword = document.getElementById('garminPassword');
const garminPasswordGroup = document.getElementById('garminPasswordGroup');
const garminMfaGroup = document.getElementById('garminMfaGroup');
const garminMfaCode = document.getElementById('garminMfaCode');
const garminLoginMessage = document.getElementById('garminLoginMessage');
const btnGarminLogin = document.getElementById('btnGarminLogin');
const btnGarminCancel = document.getElementById('btnGarminCancel');
const perfilPhotoInput = document.getElementById('perfilPhotoInput');
const perfilCameraInput = document.getElementById('perfilCameraInput');
const perfilPhotoImage = document.getElementById('perfilPhotoImage');
const perfilPhotoInitial = document.getElementById('perfilPhotoInitial');
const perfilPhotoRemove = document.getElementById('perfilPhotoRemove');
const perfilPhotoAdjust = document.getElementById('perfilPhotoAdjust');
const perfilPhotoEditor = document.getElementById('perfilPhotoEditor');
const perfilPhotoCanvas = document.getElementById('perfilPhotoCanvas');
const perfilPhotoZoom = document.getElementById('perfilPhotoZoom');
const perfilPhotoReset = document.getElementById('perfilPhotoReset');
const perfilPhotoApply = document.getElementById('perfilPhotoApply');
let perfilPhotoData = null;
let photoEditorImage = null;
let photoEditorOffsetX = 0;
let photoEditorOffsetY = 0;
let photoEditorZoom = 1;
let photoEditorDrag = null;
let perfilMessageTimer = null;

function renderProfilePhoto(photo, name) {
    perfilPhotoData = photo || null;
    if (perfilPhotoInitial) {
        perfilPhotoInitial.textContent = String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
        perfilPhotoInitial.hidden = Boolean(perfilPhotoData);
    }
    if (perfilPhotoImage) {
        perfilPhotoImage.src = perfilPhotoData || '';
        perfilPhotoImage.hidden = !perfilPhotoData;
    }
    if (perfilPhotoRemove) perfilPhotoRemove.hidden = !perfilPhotoData;
    if (perfilPhotoAdjust) perfilPhotoAdjust.hidden = !perfilPhotoData;
}

function loadProfilePhotoSource(file) {
    return new Promise((resolve, reject) => {
        if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            reject(new Error('Escolha uma imagem JPG, PNG ou WebP.'));
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            reject(new Error('A imagem deve ter no máximo 20 MB.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Não foi possível processar esta imagem.'));
        reader.readAsDataURL(file);
    });
}

function drawProfilePhotoEditor() {
    if (!photoEditorImage || !perfilPhotoCanvas) return;
    const context = perfilPhotoCanvas.getContext('2d');
    const canvasSize = perfilPhotoCanvas.width;
    const coverScale = Math.max(canvasSize / photoEditorImage.naturalWidth, canvasSize / photoEditorImage.naturalHeight);
    const scale = coverScale * photoEditorZoom;
    const width = photoEditorImage.naturalWidth * scale;
    const height = photoEditorImage.naturalHeight * scale;
    const maxX = Math.max(0, (width - canvasSize) / 2);
    const maxY = Math.max(0, (height - canvasSize) / 2);
    photoEditorOffsetX = Math.max(-maxX, Math.min(maxX, photoEditorOffsetX));
    photoEditorOffsetY = Math.max(-maxY, Math.min(maxY, photoEditorOffsetY));
    context.clearRect(0, 0, canvasSize, canvasSize);
    context.drawImage(photoEditorImage, (canvasSize - width) / 2 + photoEditorOffsetX, (canvasSize - height) / 2 + photoEditorOffsetY, width, height);
}

function openProfilePhotoEditor(source) {
    if (!source || !perfilPhotoEditor) return;
    const image = new Image();
    image.onload = () => {
        photoEditorImage = image;
        photoEditorOffsetX = 0;
        photoEditorOffsetY = 0;
        photoEditorZoom = 1;
        if (perfilPhotoZoom) perfilPhotoZoom.value = '1';
        perfilPhotoEditor.hidden = false;
        document.body.classList.add('perfil-photo-editor-open');
        drawProfilePhotoEditor();
    };
    image.onerror = () => showMessage('Não foi possível abrir esta imagem.', 'error');
    image.src = source;
}

function closeProfilePhotoEditor() {
    if (perfilPhotoEditor) perfilPhotoEditor.hidden = true;
    document.body.classList.remove('perfil-photo-editor-open');
    photoEditorDrag = null;
}

const GARMIN_CHECK_LABELS = {
    php: 'PHP compatível',
    curl: 'Comunicação HTTPS (cURL)',
    sodium: 'Criptografia de tokens (sodium)',
    openssl: 'OpenSSL',
    oauth_signer: 'Assinatura OAuth em PHP',
    private_storage: 'Armazenamento privado',
    garmin_outbound: 'Acesso ao servidor Garmin',
};

function renderGarminDiagnostics(diagnostics) {
    if (!garminChecks) return;
    garminChecks.textContent = '';
    Object.entries(diagnostics?.checks || {}).forEach(([key, passed]) => {
        const item = document.createElement('li');
        item.className = passed ? 'garmin-check-ok' : 'garmin-check-error';
        item.textContent = `${passed ? '✓' : '✕'} ${GARMIN_CHECK_LABELS[key] || key}`;
        garminChecks.appendChild(item);
    });
    garminChecks.classList.add('show');
}

function showGarminLoginMessage(text, type) {
    if (!garminLoginMessage) return;
    garminLoginMessage.textContent = text || '';
    garminLoginMessage.className = type ? `perfil-message ${type} show` : 'perfil-message';
}

function setGarminConnected() {
    if (garminStatusText) garminStatusText.textContent = 'Conectado';
    if (garminPassword) garminPassword.value = '';
    garminLoginForm?.classList.remove('show');
    if (btnConectarGarmin) {
        btnConectarGarmin.style.display = '';
        btnConectarGarmin.disabled = false;
        btnConectarGarmin.dataset.mode = 'disconnect';
        btnConectarGarmin.textContent = 'Desconectar Garmin';
    }
}

function showMessage(text, type) {
    if (!perfilMessage) return;
    if (perfilMessageTimer) clearTimeout(perfilMessageTimer);
    if (!text || !type) {
        perfilMessage.replaceChildren();
        perfilMessage.className = 'perfil-message';
        return;
    }
    const icon = document.createElement('span');
    icon.className = 'material-icons perfil-message-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = type === 'success' ? 'check_circle' : 'error_outline';
    const copy = document.createElement('span');
    copy.textContent = text;
    perfilMessage.replaceChildren(icon, copy);
    perfilMessage.className = `perfil-message ${type} show`;
    perfilMessageTimer = setTimeout(() => {
        perfilMessage.classList.remove('show');
    }, type === 'success' ? 3800 : 6000);
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
    renderProfilePhoto(data.foto_perfil, data.nome);
    if (garminCard) garminCard.hidden = data.garmin_pilot_enabled !== true;
}

async function handleProfilePhotoSelection(input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
        openProfilePhotoEditor(await loadProfilePhotoSource(file));
    } catch (error) {
        input.value = '';
        showMessage(error.message, 'error');
    }
}

perfilPhotoInput?.addEventListener('change', () => handleProfilePhotoSelection(perfilPhotoInput));
perfilCameraInput?.addEventListener('change', () => handleProfilePhotoSelection(perfilCameraInput));
perfilPhotoAdjust?.addEventListener('click', () => openProfilePhotoEditor(perfilPhotoData));

perfilPhotoZoom?.addEventListener('input', () => {
    photoEditorZoom = Number(perfilPhotoZoom.value) || 1;
    drawProfilePhotoEditor();
});

perfilPhotoReset?.addEventListener('click', () => {
    photoEditorOffsetX = 0;
    photoEditorOffsetY = 0;
    photoEditorZoom = 1;
    if (perfilPhotoZoom) perfilPhotoZoom.value = '1';
    drawProfilePhotoEditor();
});

perfilPhotoApply?.addEventListener('click', () => {
    if (!perfilPhotoCanvas) return;
    renderProfilePhoto(perfilPhotoCanvas.toDataURL('image/jpeg', 0.9), perfilNome?.value);
    closeProfilePhotoEditor();
    showMessage('Enquadramento pronto. Salve as alterações para confirmar.', 'success');
});

perfilPhotoEditor?.querySelectorAll('[data-photo-editor-close]').forEach((button) => button.addEventListener('click', closeProfilePhotoEditor));

perfilPhotoCanvas?.addEventListener('pointerdown', (event) => {
    photoEditorDrag = { x: event.clientX, y: event.clientY, offsetX: photoEditorOffsetX, offsetY: photoEditorOffsetY };
    perfilPhotoCanvas.setPointerCapture(event.pointerId);
});

perfilPhotoCanvas?.addEventListener('pointermove', (event) => {
    if (!photoEditorDrag) return;
    const ratio = perfilPhotoCanvas.width / perfilPhotoCanvas.getBoundingClientRect().width;
    photoEditorOffsetX = photoEditorDrag.offsetX + (event.clientX - photoEditorDrag.x) * ratio;
    photoEditorOffsetY = photoEditorDrag.offsetY + (event.clientY - photoEditorDrag.y) * ratio;
    drawProfilePhotoEditor();
});

['pointerup', 'pointercancel'].forEach((eventName) => perfilPhotoCanvas?.addEventListener(eventName, () => { photoEditorDrag = null; }));

perfilPhotoRemove?.addEventListener('click', () => {
    if (perfilPhotoInput) perfilPhotoInput.value = '';
    if (perfilCameraInput) perfilCameraInput.value = '';
    renderProfilePhoto(null, perfilNome?.value);
    showMessage('Foto removida. Salve as alterações para confirmar.', 'success');
});

perfilNome?.addEventListener('input', () => {
    if (!perfilPhotoData && perfilPhotoInitial) perfilPhotoInitial.textContent = perfilNome.value.trim().charAt(0).toUpperCase() || 'U';
});

if (btnConectarGarmin) {
    btnConectarGarmin.addEventListener('click', async () => {
        btnConectarGarmin.disabled = true;
        try {
            if (btnConectarGarmin.dataset.mode === 'disconnect') {
                const disconnectResponse = await fetch(`${API_BASE}/garmin/disconnect`, {
                    method: 'POST',
                    credentials: 'include',
                });
                const disconnectData = await disconnectResponse.json();
                if (!disconnectResponse.ok || disconnectData?.error) {
                    throw new Error(disconnectData?.error || 'Não foi possível desconectar o Garmin.');
                }
                btnConectarGarmin.dataset.mode = '';
                btnConectarGarmin.textContent = 'Conectar Garmin';
                if (garminStatusText) garminStatusText.textContent = 'Não conectado';
                btnConectarGarmin.disabled = false;
                return;
            }
            const response = await fetch(`${API_BASE}/garmin/status`, { credentials: 'include' });
            const data = await response.json();
            if (!response.ok || data?.pilot_enabled !== true) {
                throw new Error(data?.error || 'Acesso ao piloto Garmin não autorizado.');
            }
            renderGarminDiagnostics(data.diagnostics);
            garminSecurityNote?.classList.add('show');
            if (data.connected) {
                setGarminConnected();
            } else if (data.diagnostics?.ready) {
                if (garminStatusText) garminStatusText.textContent = 'Pronto para conectar';
                btnConectarGarmin.style.display = 'none';
                garminLoginForm?.classList.add('show');
                garminEmail?.focus();
            } else {
                if (garminStatusText) garminStatusText.textContent = 'Ambiente incompleto';
                btnConectarGarmin.textContent = 'Verificar novamente';
                btnConectarGarmin.disabled = false;
            }
        } catch (err) {
            showMessage(err.message || 'Não foi possível iniciar a conexão Garmin.', 'error');
            btnConectarGarmin.disabled = false;
        }
    });
}

if (garminLoginForm) {
    garminLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (btnGarminLogin) btnGarminLogin.disabled = true;
        showGarminLoginMessage('', '');
        const isMfa = garminMfaGroup?.hidden === false;
        try {
            const response = await fetch(`${API_BASE}/garmin/${isMfa ? 'mfa' : 'connect'}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isMfa
                    ? { code: (garminMfaCode?.value || '').trim() }
                    : { email: (garminEmail?.value || '').trim(), password: garminPassword?.value || '' }),
            });
            const data = await response.json();
            if (data?.status === 'captcha_required') {
                throw new Error('A Garmin solicitou CAPTCHA ao servidor. O teste foi interrompido; não tente novamente agora.');
            }
            if (data?.status === 'invalid_credentials') {
                throw new Error('A Garmin não aceitou as credenciais. Confirme o login no site antes de uma nova tentativa.');
            }
            if (!response.ok || data?.error) {
                throw new Error(data?.error || 'Não foi possível conectar ao Garmin.');
            }
            if (data?.status === 'mfa_required') {
                if (garminPassword) garminPassword.value = '';
                if (garminPasswordGroup) garminPasswordGroup.hidden = true;
                if (garminMfaGroup) garminMfaGroup.hidden = false;
                if (btnGarminLogin) btnGarminLogin.textContent = 'Validar código';
                showGarminLoginMessage('Digite o código MFA enviado pela Garmin.', 'success');
                garminMfaCode?.focus();
                return;
            }
            if (data?.status === 'connected') {
                showGarminLoginMessage('Conta Garmin conectada com sucesso.', 'success');
                setGarminConnected();
                return;
            }
            throw new Error('Resposta inesperada do Garmin Connect.');
        } catch (err) {
            showGarminLoginMessage(err.message || 'Erro ao conectar.', 'error');
        } finally {
            if (!isMfa && garminPassword) garminPassword.value = '';
            if (btnGarminLogin) btnGarminLogin.disabled = false;
        }
    });
}

if (btnGarminCancel) {
    btnGarminCancel.addEventListener('click', () => {
        if (garminPassword) garminPassword.value = '';
        garminLoginForm?.classList.remove('show');
        if (btnConectarGarmin) {
            btnConectarGarmin.style.display = '';
            btnConectarGarmin.disabled = false;
            btnConectarGarmin.textContent = 'Conectar Garmin';
        }
    });
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
            const body = { nome, sexo, foto_perfil: perfilPhotoData };
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
            document.querySelectorAll('.user-menu-inicial, .user-menu-summary-avatar').forEach((headerAvatar) => {
                headerAvatar.textContent = '';
                if (perfilPhotoData) {
                    const avatarImage = document.createElement('img');
                    avatarImage.src = perfilPhotoData;
                    avatarImage.alt = '';
                    headerAvatar.appendChild(avatarImage);
                } else {
                    headerAvatar.textContent = nome.charAt(0).toUpperCase() || 'U';
                }
            });
            document.querySelector('.btn-user-menu')?.classList.toggle('has-photo', Boolean(perfilPhotoData));
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
