(function initStagingRedesign() {
    const isStaging = window.location.pathname === '/dev' || window.location.pathname.startsWith('/dev/');

    if (!isStaging) return;

    document.documentElement.classList.add('staging-redesign');

    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(robotsMeta);

    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('staging-redesign');

        const banner = document.createElement('div');
        banner.className = 'staging-environment-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = '<span class="staging-environment-dot" aria-hidden="true"></span><strong>Ambiente de testes</strong><span>Nova experiência Age Run</span>';
        document.body.prepend(banner);

        const path = window.location.pathname.replace(/\/$/, '');
        const main = document.querySelector('main');
        if (!main) return;

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
        }
    });
})();
