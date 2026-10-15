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
    let confirmResolver = null;
    let confirmTrigger = null;

    const closeRemoveConfirm = (confirmed) => {
        const modal = document.getElementById('passkeyRemoveConfirm');
        if (!modal || !confirmResolver) return;
        modal.hidden = true;
        document.body.classList.remove('passkey-confirm-open');
        const resolve = confirmResolver;
        confirmResolver = null;
        resolve(confirmed);
        confirmTrigger?.focus();
        confirmTrigger = null;
    };

    const confirmPasskeyRemoval = (trigger) => {
        let modal = document.getElementById('passkeyRemoveConfirm');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'passkeyRemoveConfirm';
            modal.className = 'passkey-confirm-modal';
            modal.hidden = true;
            modal.innerHTML = `
                <button type="button" class="passkey-confirm-backdrop" data-passkey-confirm="cancel" aria-label="Cancelar exclusão"></button>
                <section class="passkey-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="passkeyConfirmTitle" aria-describedby="passkeyConfirmDescription">
                    <span class="material-icons passkey-confirm-icon" aria-hidden="true">fingerprint</span>
                    <div class="passkey-confirm-copy">
                        <h2 id="passkeyConfirmTitle">Excluir biometria?</h2>
                        <p id="passkeyConfirmDescription">O acesso por biometria deixará de funcionar neste aparelho.</p>
                    </div>
                    <div class="passkey-confirm-actions">
                        <button type="button" class="btn passkey-confirm-cancel" data-passkey-confirm="cancel">Cancelar</button>
                        <button type="button" class="btn passkey-confirm-remove" data-passkey-confirm="remove"><span class="material-icons" aria-hidden="true">delete_outline</span> Excluir</button>
                    </div>
                </section>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', (event) => {
                const action = event.target.closest('[data-passkey-confirm]')?.dataset.passkeyConfirm;
                if (action) closeRemoveConfirm(action === 'remove');
            });
        }
        confirmTrigger = trigger;
        modal.hidden = false;
        document.body.classList.add('passkey-confirm-open');
        window.setTimeout(() => modal.querySelector('.passkey-confirm-cancel')?.focus(), 0);
        return new Promise((resolve) => { confirmResolver = resolve; });
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && confirmResolver) closeRemoveConfirm(false);
    });

    async function loadCredentials() {
        if (!list || !supported) return;
        const data = await request('/auth/passkey/credentials');
        const credentials = data.credentials || [];
        const registered = Boolean(credentials[0]?.credential_id);
        if (registered) localStorage.setItem('agerun-passkey-id', credentials[0].credential_id);
        registerButton.hidden = registered;
        list.innerHTML = registered
            ? `<li class="passkey-registered-row"><span class="passkey-registered-tag"><span class="material-icons" aria-hidden="true">check_circle</span> Biometria cadastrada</span><button type="button" class="passkey-delete-button" data-passkey-remove="${credentials[0].id}" aria-label="Excluir biometria"><span class="material-icons" aria-hidden="true">delete_outline</span> Excluir</button></li>`
            : '';
        list.hidden = !registered;
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
            localStorage.setItem('agerun-passkey-id', credential.id);
            showStatus('', 'success');
            await loadCredentials();
        } catch (error) {
            showStatus(friendlyError(error), 'error');
        } finally {
            registerButton.disabled = false;
        }
    });

    list?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-passkey-remove]');
        if (!button || !await confirmPasskeyRemoval(button)) return;
        button.disabled = true;
        try {
            await request(`/auth/passkey/credentials/${button.dataset.passkeyRemove}`, { method: 'DELETE' });
            localStorage.removeItem('agerun-passkey-id');
            showStatus('Biometria excluída.', 'success');
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
