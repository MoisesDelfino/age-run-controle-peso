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

        const navMenu = document.querySelector('.nav-menu');
        const navList = navMenu?.querySelector('.nav-list');
        if (navMenu && navList && !navMenu.querySelector('.staging-nav-header')) {
            const navHeader = document.createElement('div');
            navHeader.className = 'staging-nav-header';
            navHeader.innerHTML = `
                <div class="staging-nav-brand">
                    <img src="logo.png" alt="Age Run">
                    <div><strong>Age Run</strong><span>Navegação</span></div>
                </div>
                <button type="button" class="staging-nav-close" aria-label="Fechar menu">
                    <span class="material-icons" aria-hidden="true">close</span>
                </button>`;
            navMenu.querySelector('.container')?.prepend(navHeader);
            navHeader.querySelector('.staging-nav-close')?.addEventListener('click', () => {
                document.querySelector('.menu-toggle')?.click();
            });

            const iconMap = {
                '/home': 'home',
                '/pesagem': 'monitor_weight',
                '/ranking': 'emoji_events',
                '/grupos-treino': 'groups',
                '/bioimpedancia': 'analytics',
                '/treinador': 'sports',
                '/monitoramento': 'terminal',
                '/monitoramento-acessos': 'history'
            };

            const enhanceLinks = () => {
                navList.querySelectorAll('.nav-link').forEach((link) => {
                    if (link.dataset.stagingNavReady === 'true' && link.querySelector('.staging-nav-label')) return;
                    const pathname = new URL(link.href, window.location.origin).pathname.replace(/^\/dev|^\/controle/, '');
                    const icon = iconMap[pathname] || 'circle';
                    const label = link.textContent.replace(/^[^\p{L}\p{N}]+/u, '').trim();
                    link.innerHTML = `<span class="material-icons staging-nav-icon" aria-hidden="true">${icon}</span><span class="staging-nav-label">${label}</span><span class="material-icons staging-nav-chevron" aria-hidden="true">chevron_right</span>`;
                    link.dataset.stagingNavReady = 'true';
                });
            };

            enhanceLinks();
            new MutationObserver(enhanceLinks).observe(navList, { childList: true, subtree: true });

            const bottomNav = document.createElement('nav');
            bottomNav.className = 'staging-bottom-nav';
            bottomNav.setAttribute('aria-label', 'Navegação principal');

            const moreOverlay = document.createElement('button');
            moreOverlay.type = 'button';
            moreOverlay.className = 'staging-more-overlay';
            moreOverlay.setAttribute('aria-label', 'Fechar mais opções');

            const moreSheet = document.createElement('section');
            moreSheet.className = 'staging-more-sheet';
            moreSheet.setAttribute('aria-hidden', 'true');
            moreSheet.innerHTML = `
                <div class="staging-more-handle" aria-hidden="true"></div>
                <div class="staging-more-heading">
                    <div><strong>Mais opções</strong></div>
                    <button type="button" class="staging-more-close" aria-label="Fechar"><span class="material-icons">close</span></button>
                </div>
                <div class="staging-more-links"></div>`;

            document.body.append(moreOverlay, moreSheet, bottomNav);

            const coreRoutes = ['/home', '/pesagem', '/ranking', '/grupos-treino'];
            const closeMore = () => {
                moreSheet.classList.remove('is-open');
                moreOverlay.classList.remove('is-open');
                moreSheet.setAttribute('aria-hidden', 'true');
                bottomNav.querySelector('.staging-bottom-more')?.setAttribute('aria-expanded', 'false');
            };
            const openMore = () => {
                moreSheet.classList.add('is-open');
                moreOverlay.classList.add('is-open');
                moreSheet.setAttribute('aria-hidden', 'false');
                bottomNav.querySelector('.staging-bottom-more')?.setAttribute('aria-expanded', 'true');
            };

            const renderBottomNavigation = () => {
                const links = Array.from(navList.querySelectorAll('.nav-link[data-staging-nav-ready]'));
                const byRoute = new Map(links.map((link) => {
                    const route = new URL(link.href, window.location.origin).pathname.replace(/^\/dev|^\/controle/, '');
                    return [route, link];
                }));

                const isAdmin = Boolean(navList.querySelector('.owner-monitor-link, .owner-access-link'));
                const isTrainer = document.body.classList.contains('is-trainer') && !isAdmin;
                const usesMore = isAdmin || isTrainer;

                bottomNav.innerHTML = coreRoutes.map((route) => {
                    const source = byRoute.get(route);
                    if (!source) return '';
                    const icon = source.querySelector('.staging-nav-icon')?.textContent || 'circle';
                    const sourceLabel = source.querySelector('.staging-nav-label')?.textContent || '';
                    const label = route === '/grupos-treino' ? 'Grupos' : sourceLabel;
                    const active = source.classList.contains('active');
                    return `<a class="staging-bottom-item${active ? ' is-active' : ''}" href="${source.href}"${active ? ' aria-current="page"' : ''}><span class="material-icons">${icon}</span><span>${label}</span></a>`;
                }).join('') + (usesMore ? `
                    <button type="button" class="staging-bottom-item staging-bottom-more" aria-expanded="false">
                        <span class="material-icons">apps</span><span>Mais</span>
                    </button>` : (() => {
                        const bio = byRoute.get('/bioimpedancia');
                        if (!bio) return '';
                        const icon = bio.querySelector('.staging-nav-icon')?.textContent || 'analytics';
                        const active = bio.classList.contains('active');
                        return `<a class="staging-bottom-item${active ? ' is-active' : ''}" href="${bio.href}"${active ? ' aria-current="page"' : ''}><span class="material-icons">${icon}</span><span>Bio</span></a>`;
                    })());

                const secondary = links.filter((link) => {
                    const route = new URL(link.href, window.location.origin).pathname.replace(/^\/dev|^\/controle/, '');
                    if (isTrainer) return route === '/treinador';
                    if (isAdmin) return !coreRoutes.includes(route);
                    return false;
                });
                const target = moreSheet.querySelector('.staging-more-links');
                target.innerHTML = secondary.map((source) => {
                    const icon = source.querySelector('.staging-nav-icon')?.textContent || 'circle';
                    const label = source.querySelector('.staging-nav-label')?.textContent || '';
                    const active = source.classList.contains('active');
                    return `<a class="staging-more-link${active ? ' is-active' : ''}" href="${source.href}"><span class="material-icons">${icon}</span><span>${label}</span><span class="material-icons">chevron_right</span></a>`;
                }).join('');

                bottomNav.querySelector('.staging-bottom-more')?.addEventListener('click', openMore);
                target.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMore));
                if (!usesMore) closeMore();
            };

            renderBottomNavigation();
            new MutationObserver(renderBottomNavigation).observe(navList, { childList: true, subtree: true });
            new MutationObserver(renderBottomNavigation).observe(document.body, { attributes: true, attributeFilter: ['class'] });
            window.setTimeout(renderBottomNavigation, 800);
            moreOverlay.addEventListener('click', closeMore);
            moreSheet.querySelector('.staging-more-close')?.addEventListener('click', closeMore);
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') closeMore();
            });
        }

        document.querySelectorAll('h1, .title-desktop').forEach((element) => {
            if (element.textContent.trim().toLowerCase() === 'controle de peso') {
                element.textContent = 'Performance, saúde e evolução';
            }
        });

        const path = window.location.pathname.replace(/\/$/, '');

        if (path.endsWith('/login')) {
            const authHeader = document.querySelector('.auth-header');
            const title = authHeader?.querySelector('h1');
            if (title) title.textContent = 'Sua evolução na corrida';
            if (authHeader && !authHeader.querySelector('.staging-auth-subtitle')) {
                const subtitle = document.createElement('p');
                subtitle.className = 'staging-auth-subtitle';
                subtitle.textContent = 'Performance, saúde e resultados em um só lugar.';
                title?.after(subtitle);
            }
        }

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

        if (path.endsWith('/treinador')) {
            const card = main.querySelector('.coach-panel-section > .card');
            const heading = card?.querySelector(':scope > h2');
            const description = card?.querySelector(':scope > .welcome-text');
            const kpis = card?.querySelector(':scope > .coach-kpi-grid');
            const pending = card?.querySelector(':scope > .coach-rp-test-panel');
            const toolbar = card?.querySelector(':scope > .coach-toolbar');
            const usersContent = toolbar?.nextElementSibling;

            if (card && heading && kpis && pending && toolbar && usersContent) {
                const searchLabel = toolbar.querySelector('label[for="coachSearchInput"]');
                const searchInput = toolbar.querySelector('#coachSearchInput');
                if (searchLabel) searchLabel.textContent = 'Buscar atleta';
                if (searchInput) searchInput.placeholder = 'Nome ou e-mail';
                heading.remove();
                description?.remove();
                kpis.remove();

                const users = document.createElement('section');
                users.className = 'staging-coach-users';
                pending.after(users);
                users.append(toolbar, usersContent);

                setupMobilePanels([
                    { key: 'reviews', label: 'Revisões', icon: 'fact_check', section: pending },
                    { key: 'athletes', label: 'Atletas', icon: 'groups', section: users }
                ], pending);

                const pendingList = pending.querySelector('#pendingTestsList');
                const pendingCount = pending.querySelector('#pendingTestsCount');
                const demoTests = [
                    { name: 'Julia Progresso', time: '26:04', distance: '5 km', pace: '05:13 /km', testDate: '14/10/2026', sentAt: 'Hoje, 08:42' },
                    { name: 'Marina Forca', time: '51:00', distance: '10 km', pace: '05:06 /km', testDate: '13/10/2026', sentAt: 'Ontem, 19:18' },
                    { name: 'Carlos Sprint', time: '27:30', distance: '5 km', pace: '05:30 /km', testDate: '12/10/2026', sentAt: '12/10, 17:05' },
                    { name: 'Lara Ficticia', time: '01:53:24', distance: '21 km', pace: '05:24 /km', testDate: '11/10/2026', sentAt: '11/10, 09:31' }
                ];

                const renderDemoReviews = () => {
                    if (!pendingList || pendingList.querySelector('.coach-rp-test-history-item:not([data-staging-demo])')) return;
                    const emptyState = pendingList.querySelector('.coach-rp-test-empty');
                    if (!emptyState && pendingList.children.length) return;

                    pendingList.innerHTML = demoTests.map((test, index) => `
                        <article class="coach-rp-test-history-item staging-demo-review" data-staging-demo="true">
                            <div class="coach-rp-test-history-main">
                                <div class="staging-demo-review-heading">
                                    <div class="coach-review-athlete"><span class="coach-review-avatar">${test.name.charAt(0)}</span><strong>${test.name}</strong></div>
                                    <span class="staging-demo-badge">Simulado</span>
                                </div>
                                <div class="coach-rp-test-chip-row">
                                    <span class="coach-rp-test-chip">${test.time}</span>
                                    <span class="coach-rp-test-chip">${test.distance}</span>
                                    <span class="coach-rp-test-chip coach-rp-test-chip-accent">${test.pace}</span>
                                </div>
                                <div class="coach-rp-test-meta-row">
                                    <span>Teste: ${test.testDate}</span><span>Enviado: ${test.sentAt}</span>
                                </div>
                            </div>
                            <div class="coach-rp-test-history-actions">
                                <button type="button" class="btn pending-test-edit staging-demo-action" data-action="correct" data-index="${index}">Corrigir</button>
                                <button type="button" class="btn pending-test-validate staging-demo-action" data-action="approve" data-index="${index}">Validar</button>
                            </div>
                        </article>`).join('');
                    if (pendingCount) {
                        pendingCount.textContent = `${demoTests.length} pendentes`;
                        pendingCount.classList.remove('coach-pending-ok');
                    }
                };

                pendingList?.addEventListener('click', (event) => {
                    const action = event.target.closest('.staging-demo-action');
                    if (!action) return;
                    const card = action.closest('.staging-demo-review');
                    const approved = action.dataset.action === 'approve';
                    card?.classList.add(approved ? 'is-approved' : 'needs-correction');
                    card?.querySelectorAll('.staging-demo-action').forEach((button) => { button.disabled = true; });
                    const badge = card?.querySelector('.staging-demo-badge');
                    if (badge) badge.textContent = approved ? 'Validado' : 'Em correção';
                });

                renderDemoReviews();
                if (pendingList) new MutationObserver(renderDemoReviews).observe(pendingList, { childList: true });
            }
        }

        if (path.endsWith('/monitoramento')) {
            const layout = main.querySelector('.query-layout');
            const editor = layout?.querySelector(':scope > .db-tool-grid');
            const result = layout?.querySelector(':scope > .db-tool-panel');
            setupMobilePanels([
                { key: 'editor', label: 'Editor', icon: 'terminal', section: editor },
                { key: 'result', label: 'Resultado', icon: 'table_view', section: result }
            ], editor);
        }

        if (path.endsWith('/monitoramento-acessos')) {
            const table = main.querySelector('.access-table');
            const applyAccessLabels = () => {
                const labels = Array.from(table?.querySelectorAll('thead th') || []).map((cell) => cell.textContent.trim());
                table?.querySelectorAll('tbody tr').forEach((row) => {
                    row.querySelectorAll('td').forEach((cell, index) => {
                        if (labels[index]) cell.dataset.label = labels[index];
                    });
                });
            };
            applyAccessLabels();
            const tbody = table?.querySelector('tbody');
            if (tbody) new MutationObserver(applyAccessLabels).observe(tbody, { childList: true, subtree: true });
        }

        if (path.endsWith('/grupos-treino')) {
            const rp = main.querySelector('.rp-section');
            const groups = main.querySelector('.grupos-section');
            rp?.classList.add('staging-relocated-training');
            groups?.classList.add('is-mobile-active');

            const grid = groups?.querySelector('.groups-grid');
            const columns = Array.from(grid?.querySelectorAll('.group-column') || []);
            if (grid && columns.length) {
                const labels = [
                    { label: 'Mesmo ritmo', icon: 'group' },
                    { label: 'Mais rápidos', icon: 'trending_up' },
                    { label: 'Para apoiar', icon: 'volunteer_activism' }
                ];
                const tabs = document.createElement('div');
                tabs.className = 'staging-group-tabs';
                tabs.setAttribute('role', 'tablist');
                tabs.setAttribute('aria-label', 'Categorias de grupos');
                tabs.innerHTML = columns.map((column, index) => `
                    <button type="button" class="staging-group-tab${index === 0 ? ' is-active' : ''}" data-group-index="${index}" role="tab" aria-selected="${index === 0}">
                        <span class="material-icons" aria-hidden="true">${labels[index]?.icon || 'group'}</span>
                        <span>${labels[index]?.label || `Grupo ${index + 1}`}</span>
                    </button>`).join('');
                grid.before(tabs);
                columns.forEach((column, index) => column.classList.toggle('is-active', index === 0));
                tabs.addEventListener('click', (event) => {
                    const button = event.target.closest('.staging-group-tab');
                    if (!button) return;
                    const selectedIndex = Number(button.dataset.groupIndex);
                    tabs.querySelectorAll('.staging-group-tab').forEach((tab, index) => {
                        const selected = index === selectedIndex;
                        tab.classList.toggle('is-active', selected);
                        tab.setAttribute('aria-selected', String(selected));
                    });
                    columns.forEach((column, index) => column.classList.toggle('is-active', index === selectedIndex));
                });
            }
        }

        if (path.endsWith('/home')) {
            main.classList.add('staging-home');

            const section = main.querySelector('.home-stats-section');
            if (section) {
                const records = document.createElement('section');
                records.className = 'card staging-home-training-card';
                records.innerHTML = `
                    <form id="homeRpForm" class="rp-form">
                        <div class="rp-grid">
                            ${[
                                ['5k', '5 km'],
                                ['10k', '10 km'],
                                ['21k', 'Meia Maratona (21k)'],
                                ['42k', 'Maratona (42k)']
                            ].map(([key, label]) => `
                                <div class="form-group">
                                    <label for="homeRp${key}"><span>${label}</span><span id="homeStatusRp${key}" class="rp-status-badge status-sem-rp">Sem RP</span><span id="homePaceRp${key}" class="rp-pace-inline"></span></label>
                                    <input type="text" id="homeRp${key}" placeholder="mm:ss ou hh:mm:ss">
                                </div>`).join('')}
                        </div>
                        <div class="rp-actions">
                            <button type="submit" class="btn btn-primary">Salvar RPs</button>
                            <span id="homeRpPaceSummary" class="rp-pace-summary"></span>
                        </div>
                        <div id="homeRpMessage" class="message" role="status"></div>
                    </form>`;

                const tests = document.createElement('section');
                tests.className = 'card staging-home-training-card';
                tests.innerHTML = `
                    <button type="button" id="homeTestFormToggle" class="staging-test-form-toggle" aria-expanded="false">
                        <span class="material-icons" aria-hidden="true">add</span>
                        <span>Cadastrar teste</span>
                    </button>
                    <form id="homeAthleteTestForm" class="coach-rp-test-controls staging-test-form" hidden>
                        <div class="coach-rp-test-field">
                            <label class="group-meta" for="homeAthleteTestTime">Tempo</label>
                            <input id="homeAthleteTestTime" class="coach-rp-test-input" type="text" placeholder="12:00" required>
                        </div>
                        <div class="coach-rp-test-field">
                            <label class="group-meta" for="homeAthleteTestDistance">Distância (km)</label>
                            <input id="homeAthleteTestDistance" class="coach-rp-test-input" type="number" min="0.01" max="1000" step="0.01" placeholder="2" required>
                        </div>
                        <div class="coach-rp-test-field">
                            <label class="group-meta" for="homeAthleteTestDate">Data do teste</label>
                            <input id="homeAthleteTestDate" class="coach-rp-test-input" type="date" required>
                        </div>
                        <div class="coach-rp-test-preview">
                            <span class="group-meta">Pace calculado</span>
                            <strong id="homeAthleteTestPace" class="coach-rp-test-pace">Pace: -</strong>
                        </div>
                        <div class="coach-rp-test-buttons">
                            <button type="submit" class="btn btn-secondary">Salvar teste</button>
                            <button type="button" id="homeTestFormCancel" class="btn staging-test-form-cancel">Cancelar</button>
                        </div>
                    </form>
                    <div id="homeAthleteTestMessage" class="message" role="status"></div>
                    <div id="homeAthleteLastTest" class="coach-rp-test-history-list"></div>`;

                section.after(records, tests);
                setupMobilePanels([
                    { key: 'levels', label: 'Nível', icon: 'pets', section },
                    { key: 'records', label: 'Recordes', icon: 'timer', section: records },
                    { key: 'tests', label: 'Testes', icon: 'speed', section: tests }
                ], section);

                const trainingScript = document.createElement('script');
                trainingScript.src = '/dev/staging-home-training.js?v=2026101504';
                trainingScript.dataset.stagingHomeTraining = 'true';
                document.body.appendChild(trainingScript);
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
