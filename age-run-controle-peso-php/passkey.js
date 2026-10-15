(function initPasskeys() {
    const API_BASE = window.location.pathname.startsWith('/dev') ? '/dev/api' : '/controle/api';
    const loginButton = document.getElementById('passkeyLoginButton');
    const registerButton = document.getElementById('passkeyRegisterButton');
    const list = document.getElementById('passkeyCredentialList');
    const status = document.getElementById('passkeyStatus');
    const supported = window.isSecureContext && 'PublicKeyCredential' in window && navigator.credentials;

    const decode = (value) => {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
        const binary = atob(base64);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    };
    const encode = (value) => {
        const bytes = new Uint8Array(value);
        let binary = '';
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    };
    const request = async (path, options = {}) => {
        const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a autenticação.');
        return data;
    };
    const showStatus = (message, type = 'info') => {
        if (!status) return;
        status.textContent = message;
        status.className = `passkey-status ${type}`;
        status.hidden = !message;
    };
    const friendlyError = (error) => {
        if (error?.name === 'NotAllowedError') return 'A autenticação foi cancelada ou demorou demais. Tente novamente.';
        if (error?.name === 'InvalidStateError') return 'Este aparelho já possui uma passkey cadastrada.';
        if (error?.name === 'SecurityError') return 'O navegador bloqueou a biometria. Confirme que o site está aberto por HTTPS.';
        return error?.message || 'Não foi possível usar a biometria neste aparelho.';
    };

    async function loadCredentials() {
        if (!list || !supported) return;
        const data = await request('/auth/passkey/credentials');
        const credentials = data.credentials || [];
        if (credentials[0]?.credential_id) localStorage.setItem('agerun-passkey-id', credentials[0].credential_id);
        list.innerHTML = credentials.length
            ? credentials.map((item) => `<li><span class="material-icons" aria-hidden="true">passkey</span><div><strong>${item.nome || 'Este aparelho'}</strong><small>Cadastrada em ${String(item.criado_em || '').slice(0, 10).split('-').reverse().join('/')}</small></div><button type="button" data-passkey-remove="${item.id}" aria-label="Remover passkey"><span class="material-icons">delete_outline</span></button></li>`).join('')
            : '<li class="passkey-empty">Nenhum aparelho cadastrado.</li>';
    }

    if (!supported) {
        loginButton?.setAttribute('hidden', '');
        registerButton?.setAttribute('hidden', '');
        if (list) list.innerHTML = '<li class="passkey-empty">Este navegador não oferece suporte a passkeys.</li>';
        return;
    }

    registerButton?.addEventListener('click', async () => {
        registerButton.disabled = true;
        showStatus('Confirme sua identidade no aparelho…');
        try {
            const options = await request('/auth/passkey/register-options', { method: 'POST' });
            options.challenge = decode(options.challenge);
            options.user.id = decode(options.user.id);
            options.excludeCredentials = (options.excludeCredentials || []).map((item) => ({ ...item, id: decode(item.id) }));
            const credential = await navigator.credentials.create({ publicKey: options });
            const transports = credential.response.getTransports ? credential.response.getTransports() : [];
            await request('/auth/passkey/register-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: credential.id,
                    clientDataJSON: encode(credential.response.clientDataJSON),
                    attestationObject: encode(credential.response.attestationObject),
                    transports,
                    name: /android/i.test(navigator.userAgent) ? 'Celular Android' : /iphone|ipad/i.test(navigator.userAgent) ? 'iPhone ou iPad' : 'Este aparelho',
                }),
            });
            showStatus('Biometria ativada com sucesso neste aparelho.', 'success');
            localStorage.setItem('agerun-passkey-id', credential.id);
            await loadCredentials();
        } catch (error) {
            showStatus(friendlyError(error), 'error');
        } finally {
            registerButton.disabled = false;
        }
    });

    list?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-passkey-remove]');
        if (!button || !window.confirm('Remover o acesso por biometria deste aparelho?')) return;
        button.disabled = true;
        try {
            await request(`/auth/passkey/credentials/${button.dataset.passkeyRemove}`, { method: 'DELETE' });
            localStorage.removeItem('agerun-passkey-id');
            showStatus('Passkey removida.', 'success');
            await loadCredentials();
        } catch (error) {
            showStatus(friendlyError(error), 'error');
            button.disabled = false;
        }
    });

    loginButton?.addEventListener('click', async () => {
        const credentialId = localStorage.getItem('agerun-passkey-id') || '';
        if (!credentialId) {
            if (typeof mostrarMensagem === 'function') mostrarMensagem('Entre com a senha uma vez e cadastre a biometria no perfil deste aparelho.', 'error');
            return;
        }
        loginButton.disabled = true;
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Aguardando confirmação no aparelho…', 'success', { persist: true, loading: true });
        try {
            const options = await request('/auth/passkey/login-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential_id: credentialId }),
            });
            options.challenge = decode(options.challenge);
            options.allowCredentials = (options.allowCredentials || []).map((item) => ({ ...item, id: decode(item.id) }));
            const credential = await navigator.credentials.get({ publicKey: options });
            const data = await request('/auth/passkey/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: credential.id,
                    clientDataJSON: encode(credential.response.clientDataJSON),
                    authenticatorData: encode(credential.response.authenticatorData),
                    signature: encode(credential.response.signature),
                    userHandle: credential.response.userHandle ? encode(credential.response.userHandle) : null,
                }),
            });
            if (typeof mostrarMensagem === 'function') mostrarMensagem('Acesso confirmado', 'success', { detail: 'Preparando seu painel…', loading: true });
            window.setTimeout(() => { window.location.href = data.require_password_change ? `${window.location.pathname.startsWith('/dev') ? '/dev' : '/controle'}/primeiro-acesso` : `${window.location.pathname.startsWith('/dev') ? '/dev' : '/controle'}/home`; }, 500);
        } catch (error) {
            if (typeof mostrarMensagem === 'function') mostrarMensagem(friendlyError(error), 'error');
        } finally {
            loginButton.disabled = false;
        }
    });

    loadCredentials().catch((error) => showStatus(friendlyError(error), 'error'));
})();
