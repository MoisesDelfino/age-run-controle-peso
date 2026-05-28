(function() {
    const THEME_STORAGE_KEY = 'agerun-theme';
    const DARK_CLASS = 'dark-mode';
    const PWA_DISMISSED_KEY = 'agerun-pwa-install-dismissed';
    const PWA_STATUS_LAST_REPORT_KEY = 'agerun-pwa-status-last-report';
    const PWA_STATUS_REPORT_INTERVAL_MS = 6 * 60 * 60 * 1000;
    const PWA_BANNER_ID = 'agerun-pwa-banner';
    const PWA_STYLE_ID = 'agerun-pwa-banner-style';
    let deferredInstallPrompt = null;

    function getSavedTheme() {
        try {
            return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
        } catch (error) {
            return 'light';
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            // Ignora falha de armazenamento (ex: modo privado restrito)
        }
    }

    function isDarkModeEnabled() {
        return document.body.classList.contains(DARK_CLASS);
    }

    function updateToggleButtons(isDarkMode) {
        const toggleButtons = document.querySelectorAll('[data-theme-toggle], #btnDarkMode');

        toggleButtons.forEach((button) => {
            const icon = button.querySelector('.material-icons');
            if (icon) {
                icon.textContent = isDarkMode ? 'light_mode' : 'dark_mode';
            }

            const action = isDarkMode ? 'Desativar' : 'Ativar';
            button.setAttribute('aria-label', `${action} modo escuro`);
            button.setAttribute('title', `${action} modo escuro`);
        });
    }

    function applyTheme(theme) {
        const isDarkMode = theme === 'dark';
        document.body.classList.toggle(DARK_CLASS, isDarkMode);
        updateToggleButtons(isDarkMode);
    }

    function applySavedTheme() {
        applyTheme(getSavedTheme());
    }

    function toggleTheme() {
        const nextTheme = isDarkModeEnabled() ? 'light' : 'dark';
        saveTheme(nextTheme);
        applyTheme(nextTheme);
    }

    function bindToggleButtons() {
        const toggleButtons = document.querySelectorAll('[data-theme-toggle], #btnDarkMode');

        toggleButtons.forEach((button) => {
            if (button.dataset.themeBound === 'true') {
                return;
            }

            button.addEventListener('click', (event) => {
                event.preventDefault();
                toggleTheme();
            });

            button.dataset.themeBound = 'true';
        });
    }

    function initTheme() {
        applySavedTheme();
        bindToggleButtons();
    }

    function isStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isIosDevice() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
    }

    function isIosSafariBrowser() {
        if (!isIosDevice()) {
            return false;
        }

        const ua = window.navigator.userAgent;
        const isSafari = /safari/i.test(ua);
        const isOtherBrowser = /crios|fxios|edgios|opios|mercury|duckduckgo/i.test(ua);
        return isSafari && !isOtherBrowser;
    }

    function isMobileInstallDevice() {
        if (isIosDevice()) {
            return true;
        }

        if (window.navigator.userAgentData && typeof window.navigator.userAgentData.mobile === 'boolean') {
            return window.navigator.userAgentData.mobile;
        }

        return /android|iphone|ipad|ipod|iemobile|opera mini|mobile/i.test(window.navigator.userAgent)
            || (window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches);
    }

    function shouldPersistPwaDismissal() {
        // No iOS, o aviso precisa voltar enquanto não estiver em modo instalado.
        return !isIosDevice();
    }

    function hasDismissedPwaBanner() {
        if (!shouldPersistPwaDismissal()) {
            return false;
        }

        try {
            return localStorage.getItem(PWA_DISMISSED_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function markPwaBannerDismissed() {
        if (!shouldPersistPwaDismissal()) {
            return;
        }

        try {
            localStorage.setItem(PWA_DISMISSED_KEY, '1');
        } catch (error) {
            // Ignora falha de armazenamento.
        }
    }

    function clearPwaBannerDismissed() {
        try {
            localStorage.removeItem(PWA_DISMISSED_KEY);
        } catch (error) {
            // Ignora falha de armazenamento.
        }
    }

    function getApiBasePath() {
        const pathname = window.location.pathname || '';
        if (pathname === '/dev' || pathname.startsWith('/dev/')) {
            return '/dev/api';
        }
        if (pathname === '/controle' || pathname.startsWith('/controle/')) {
            return '/controle/api';
        }
        return '/api';
    }

    async function reportPwaInstallStatus(source, force = false) {
        if (!isMobileInstallDevice()) {
            return;
        }

        const standalone = isStandaloneMode();
        const now = Date.now();

        if (!force) {
            try {
                const last = Number(localStorage.getItem(PWA_STATUS_LAST_REPORT_KEY) || 0);
                if (last > 0 && (now - last) < PWA_STATUS_REPORT_INTERVAL_MS) {
                    return;
                }
            } catch (error) {
                // Ignora falha de storage.
            }
        }

        try {
            localStorage.setItem(PWA_STATUS_LAST_REPORT_KEY, String(now));
        } catch (error) {
            // Ignora falha de storage.
        }

        const platform = isIosDevice() ? 'ios' : (/android/i.test(window.navigator.userAgent) ? 'android' : 'mobile');

        try {
            await fetch(`${getApiBasePath()}/monitoramento/pwa-status`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    installed: standalone,
                    standalone,
                    source: source || 'heartbeat',
                    platform
                })
            });
        } catch (error) {
            // Endpoint de telemetria opcional; não impacta UX.
        }
    }

    function ensurePwaHeadTags() {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) {
            return;
        }

        const ensureLink = (rel, href, type) => {
            const existing = head.querySelector(`link[rel="${rel}"]`);
            if (existing) {
                existing.setAttribute('href', href);
                if (type) {
                    existing.setAttribute('type', type);
                }
                return;
            }

            const link = document.createElement('link');
            link.rel = rel;
            link.href = href;
            if (type) {
                link.type = type;
            }
            head.appendChild(link);
        };

        const ensureMeta = (name, content) => {
            const existing = head.querySelector(`meta[name="${name}"]`);
            if (existing) {
                existing.setAttribute('content', content);
                return;
            }

            const meta = document.createElement('meta');
            meta.name = name;
            meta.content = content;
            head.appendChild(meta);
        };

        ensureLink('manifest', 'manifest.json');
        ensureLink('apple-touch-icon', 'apple-touch-icon.png');
        ensureMeta('theme-color', '#0f172a');
        ensureMeta('apple-mobile-web-app-capable', 'yes');
        ensureMeta('mobile-web-app-capable', 'yes');
        ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    }

    function ensurePwaBannerStyle() {
        if (document.getElementById(PWA_STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = PWA_STYLE_ID;
        style.textContent = `
            .pwa-install-banner {
                position: fixed;
                left: 16px;
                right: 16px;
                bottom: 16px;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 16px;
                border-radius: 16px;
                background: rgba(11, 18, 32, 0.96);
                color: #f8fafc;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(148, 163, 184, 0.18);
                backdrop-filter: blur(12px);
            }

            .pwa-install-banner__text {
                min-width: 0;
                flex: 1 1 auto;
                display: grid;
                gap: 4px;
            }

            .pwa-install-banner__title {
                font-weight: 700;
                font-size: 0.98rem;
                line-height: 1.2;
            }

            .pwa-install-banner__body {
                font-size: 0.88rem;
                line-height: 1.35;
                color: #cbd5e1;
            }

            .pwa-install-banner__actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }

            .pwa-install-banner__button,
            .pwa-install-banner__dismiss {
                appearance: none;
                border: 0;
                border-radius: 999px;
                padding: 10px 14px;
                font: inherit;
                cursor: pointer;
                transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
            }

            .pwa-install-banner__button {
                background: linear-gradient(135deg, #22c55e, #10b981);
                color: #04111f;
                font-weight: 700;
            }

            .pwa-install-banner__dismiss {
                background: rgba(148, 163, 184, 0.16);
                color: #e2e8f0;
            }

            .pwa-install-banner__button:hover,
            .pwa-install-banner__dismiss:hover {
                transform: translateY(-1px);
                opacity: 0.96;
            }

            @media (max-width: 640px) {
                .pwa-install-banner {
                    flex-direction: column;
                    align-items: stretch;
                }

                .pwa-install-banner__actions {
                    width: 100%;
                }

                .pwa-install-banner__button,
                .pwa-install-banner__dismiss {
                    flex: 1 1 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function removePwaBanner() {
        const existing = document.getElementById(PWA_BANNER_ID);
        if (existing) {
            existing.remove();
        }
    }

    function showPwaBanner(title, body, actionLabel, onAction, dismissLabel = 'Agora não') {
        ensurePwaBannerStyle();
        removePwaBanner();

        const banner = document.createElement('div');
        banner.id = PWA_BANNER_ID;
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-install-banner__text">
                <div class="pwa-install-banner__title">${title}</div>
                <div class="pwa-install-banner__body">${body}</div>
            </div>
            <div class="pwa-install-banner__actions">
                ${actionLabel ? `<button type="button" class="pwa-install-banner__button">${actionLabel}</button>` : ''}
                <button type="button" class="pwa-install-banner__dismiss">${dismissLabel}</button>
            </div>
        `;

        const actionButton = banner.querySelector('.pwa-install-banner__button');
        const dismissButton = banner.querySelector('.pwa-install-banner__dismiss');

        if (actionButton && onAction) {
            actionButton.addEventListener('click', async () => {
                await onAction();
            });
        }

        dismissButton?.addEventListener('click', () => {
            markPwaBannerDismissed();
            removePwaBanner();
        });

        document.body.appendChild(banner);
    }

    async function triggerInstallPrompt() {
        if (!deferredInstallPrompt) {
            return;
        }

        deferredInstallPrompt.prompt();
        try {
            await deferredInstallPrompt.userChoice;
        } catch (error) {
            // Ignora cancelamento/erros do prompt.
        }

        deferredInstallPrompt = null;
        removePwaBanner();
        clearPwaBannerDismissed();
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        navigator.serviceWorker.register('sw.js').catch(() => {
            // Registro opcional; a web app segue funcionando sem o SW.
        });
    }

    function initPwa() {
        ensurePwaHeadTags();
        registerServiceWorker();
        reportPwaInstallStatus(isStandaloneMode() ? 'standalone' : 'heartbeat');

        if (isStandaloneMode()) {
            return;
        }

        if (!isMobileInstallDevice()) {
            return;
        }

        if (hasDismissedPwaBanner()) {
            return;
        }

        if (isIosDevice()) {
            if (isIosSafariBrowser()) {
                showPwaBanner(
                    'Adicione à tela inicial',
                    'No Safari do iPhone, toque em Compartilhar e depois em "Adicionar à Tela de Início".',
                    '',
                    null,
                    'Entendi'
                );
            } else {
                showPwaBanner(
                    'Instalação no iPhone',
                    'Para instalar no iPhone, abra este site no Safari e use "Adicionar à Tela de Início".',
                    '',
                    null,
                    'Entendi'
                );
            }
        }
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        if (!isMobileInstallDevice()) {
            return;
        }

        event.preventDefault();
        deferredInstallPrompt = event;

        if (isStandaloneMode() || hasDismissedPwaBanner()) {
            return;
        }

        showPwaBanner(
            'Instale o Age Run',
            'Adicione o aplicativo à tela inicial do celular para abrir com ícone próprio e acesso rápido.',
            'Instalar',
            triggerInstallPrompt
        );
    });

    window.addEventListener('appinstalled', () => {
        reportPwaInstallStatus('appinstalled', true);
        deferredInstallPrompt = null;
        clearPwaBannerDismissed();
        removePwaBanner();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPwa);
    } else {
        initPwa();
    }

    window.AgeRunTheme = {
        applySavedTheme,
        toggleTheme
    };
})();
