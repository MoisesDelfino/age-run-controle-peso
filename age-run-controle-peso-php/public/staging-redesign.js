(function initStagingRedesign() {
    const isStaging = window.location.pathname === '/dev' || window.location.pathname.startsWith('/dev/');

    if (!isStaging) return;
    if (window.__AGE_RUN_STAGING_REDESIGN__) return;
    window.__AGE_RUN_STAGING_REDESIGN__ = true;

    document.documentElement.classList.add('staging-redesign');

    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(robotsMeta);

    const initPage = () => {
        document.body.classList.add('staging-redesign');

        const pageSlug = window.location.pathname
            .replace(/^\/dev\/?/, '')
            .replace(/\/$/, '')
            .replace(/[^a-z0-9-]/gi, '-') || 'index';
        document.body.classList.add(`staging-page-${pageSlug}`);
        document.body.classList.toggle('staging-auth-page', Boolean(document.querySelector('.auth-container')));

        document.querySelectorAll('footer, .footer').forEach((footer) => footer.remove());

        const banner = document.createElement('div');
        banner.className = 'staging-environment-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = '<span class="staging-environment-dot" aria-hidden="true"></span><strong>Ambiente de testes</strong><span>Nova experiência Age Run</span>';
        document.body.prepend(banner);

        const path = window.location.pathname.replace(/\/$/, '');
        const main = document.querySelector('main');
        if (!main) return;

        const setupMobilePanels = (items, insertBefore) => {
            const validItems = items.filter((item) => item.section);
            if (validItems.length < 2 || !insertBefore) return;

            const tabs = document.createElement('div');
            tabs.className = 'staging-mobile-tabs staging-page-tabs';
            tabs.setAttribute('role', 'tablist');
            tabs.setAttribute('aria-label', 'Áreas da página');
            tabs.innerHTML = validItems.map((item, index) => `
                <button type="button" class="staging-mobile-tab${index === 0 ? ' is-active' : ''}" role="tab" aria-selected="${index === 0}" data-target="${item.key}">
                    <span class="material-icons" aria-hidden="true">${item.icon}</span>
                    <span>${item.label}</span>
                </button>
            `).join('');
            insertBefore.before(tabs);

            validItems.forEach((item, index) => {
                item.section.classList.add('staging-mobile-panel');
                item.section.dataset.mobilePanel = item.key;
                item.section.classList.toggle('is-mobile-active', index === 0);
            });

            const selectPanel = (target) => {
                tabs.querySelectorAll('.staging-mobile-tab').forEach((tab) => {
                    const selected = tab.dataset.target === target;
                    tab.classList.toggle('is-active', selected);
                    tab.setAttribute('aria-selected', String(selected));
                });
                validItems.forEach((item) => {
                    item.section.classList.toggle('is-mobile-active', item.key === target);
                });
            };

            tabs.addEventListener('click', (event) => {
                const tab = event.target.closest('.staging-mobile-tab');
                if (tab) selectPanel(tab.dataset.target);
            });
        };

        if (path.endsWith('/bioimpedancia')) {
            const page = main.querySelector('.bioimpedancia-page');
            const health = page?.querySelector('.imc-section-full');
            const register = page?.querySelector('.bioimpedancia-section-full');
            const history = page?.querySelector('.historico-bio-section');
            setupMobilePanels([
                { key: 'health', label: 'Saúde', icon: 'favorite_border', section: health },
                { key: 'register', label: 'Registrar', icon: 'add_circle_outline', section: register },
                { key: 'history', label: 'Histórico', icon: 'history', section: history }
            ], page);
        }

        if (path.endsWith('/grupos-treino')) {
            const rp = main.querySelector('.rp-section');
            const records = rp?.querySelector('#rpForm');
            const tests = rp?.querySelector('.athlete-test-panel');
            const groups = main.querySelector('.grupos-section');
            setupMobilePanels([
                { key: 'records', label: 'Recordes', icon: 'timer', section: records },
                { key: 'tests', label: 'Testes', icon: 'speed', section: tests },
                { key: 'groups', label: 'Grupos', icon: 'groups', section: groups }
            ], rp);
        }

        if (path.endsWith('/home')) {
            main.classList.add('staging-home');

            const section = main.querySelector('.home-stats-section');
            if (section) {
                const intro = document.createElement('section');
                intro.className = 'staging-page-intro';
                intro.innerHTML = `
                    <div>
                        <span class="staging-eyebrow">Seu painel</span>
                        <h2>Olá! Vamos acompanhar sua evolução?</h2>
                        <p>Veja seus principais indicadores e mantenha seus registros em dia.</p>
                    </div>
                    <a class="staging-primary-action" href="./pesagem">
                        <span class="material-icons" aria-hidden="true">add</span>
                        Registrar pesagem
                    </a>
                `;
                section.before(intro);
            }
        }

        if (path.endsWith('/pesagem')) {
            main.classList.add('staging-weighing');

            const layout = main.querySelector('.pesagem-layout');
            if (layout) {
                const intro = document.createElement('section');
                intro.className = 'staging-page-intro staging-page-intro-compact';
                intro.innerHTML = `
                    <div>
                        <a class="staging-back-link" href="./home"><span class="material-icons" aria-hidden="true">arrow_back</span> Início</a>
                        <span class="staging-eyebrow">Acompanhe sua evolução</span>
                        <h2>Registrar pesagem</h2>
                        <p>Leva menos de um minuto. Use o peso medido nas mesmas condições das pesagens anteriores.</p>
                    </div>
                `;
                layout.before(intro);
            }

            const formCard = document.querySelector('.form-section .card');
            const formTitle = formCard?.querySelector('h2');
            if (formTitle) formTitle.innerHTML = '<span class="staging-section-icon material-icons" aria-hidden="true">monitor_weight</span><span>Nova medição</span>';

            const statsTitle = document.querySelector('.stats-section .card > h2');
            if (statsTitle) statsTitle.innerHTML = '<span class="staging-section-icon material-icons" aria-hidden="true">insights</span><span>Resumo</span>';

            const historyTitle = document.querySelector('.lista-section .card > h2');
            if (historyTitle) historyTitle.innerHTML = '<span class="staging-section-icon material-icons" aria-hidden="true">history</span><span>Pesagens recentes</span>';

            const heightTitle = document.querySelector('.form-section .card:nth-child(2) > h3');
            if (heightTitle) heightTitle.innerHTML = '<span class="staging-section-icon material-icons" aria-hidden="true">height</span><span>Altura</span>';

            const submitLabel = document.querySelector('#pesagemForm .btn-primary span');
            if (submitLabel) submitLabel.textContent = 'Salvar pesagem';

            const formSection = document.querySelector('.form-section');
            const statsSection = document.querySelector('.stats-section');
            const historySection = document.querySelector('.lista-section');

            if (layout && formSection && statsSection && historySection) {
                formSection.dataset.mobilePanel = 'register';
                statsSection.dataset.mobilePanel = 'summary';
                historySection.dataset.mobilePanel = 'history';

                const tabs = document.createElement('div');
                tabs.className = 'staging-mobile-tabs';
                tabs.setAttribute('role', 'tablist');
                tabs.setAttribute('aria-label', 'Áreas da pesagem');
                tabs.innerHTML = `
                    <button type="button" class="staging-mobile-tab is-active" role="tab" aria-selected="true" data-target="register">
                        <span class="material-icons" aria-hidden="true">add_circle_outline</span>
                        <span>Registrar</span>
                    </button>
                    <button type="button" class="staging-mobile-tab" role="tab" aria-selected="false" data-target="summary">
                        <span class="material-icons" aria-hidden="true">insights</span>
                        <span>Resumo</span>
                    </button>
                    <button type="button" class="staging-mobile-tab" role="tab" aria-selected="false" data-target="history">
                        <span class="material-icons" aria-hidden="true">history</span>
                        <span>Histórico</span>
                    </button>
                `;
                layout.before(tabs);

                const selectMobilePanel = (target) => {
                    tabs.querySelectorAll('.staging-mobile-tab').forEach((tab) => {
                        const selected = tab.dataset.target === target;
                        tab.classList.toggle('is-active', selected);
                        tab.setAttribute('aria-selected', String(selected));
                    });

                    [formSection, statsSection, historySection].forEach((section) => {
                        section.classList.toggle('is-mobile-active', section.dataset.mobilePanel === target);
                    });
                };

                tabs.addEventListener('click', (event) => {
                    const tab = event.target.closest('.staging-mobile-tab');
                    if (tab) selectMobilePanel(tab.dataset.target);
                });

                selectMobilePanel('register');
                window.addEventListener('pesagem:registered', () => selectMobilePanel('summary'));
            }

            const heightCard = formSection?.querySelector('.card:nth-child(2)');
            if (heightCard) {
                heightCard.classList.add('staging-height-card');
                const heightToggle = document.createElement('button');
                heightToggle.type = 'button';
                heightToggle.className = 'staging-height-toggle';
                heightToggle.setAttribute('aria-expanded', 'false');
                heightToggle.innerHTML = '<span><span class="material-icons" aria-hidden="true">height</span> Atualizar altura</span><span class="material-icons staging-height-chevron" aria-hidden="true">expand_more</span>';
                heightCard.before(heightToggle);
                heightToggle.addEventListener('click', () => {
                    const expanded = heightToggle.getAttribute('aria-expanded') === 'true';
                    heightToggle.setAttribute('aria-expanded', String(!expanded));
                    heightCard.classList.toggle('is-open', !expanded);
                });
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage, { once: true });
    } else {
        initPage();
    }
})();
