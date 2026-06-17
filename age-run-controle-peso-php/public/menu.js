// ==================== CONTROLE DO MENU MOBILE ====================

var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

function getAppBasePath() {
    if (window.location.pathname === '/dev' || window.location.pathname.startsWith('/dev/')) {
        return '/dev';
    }
    if (window.location.pathname === '/controle' || window.location.pathname.startsWith('/controle/')) {
        return '/controle';
    }
    return '';
}

function withBasePath(path) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const base = getAppBasePath();
    return base ? `${base}${normalizedPath}` : normalizedPath;
}

function normalizarLinksMenu() {
    const rotasAplicacao = new Set([
        '/home',
        '/pesagem',
        '/ranking',
        '/grupos-treino',
        '/bioimpedancia',
        '/treinador',
        '/monitoramento',
        '/monitoramento-acessos',
        '/perfil',
        '/login',
        '/cadastro',
        '/recuperar-senha'
    ]);

    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) {
            return;
        }

        const semControle = href.startsWith('/controle/')
            ? href.replace(/^\/controle/, '')
            : href;

        if (!rotasAplicacao.has(semControle)) {
            return;
        }

        link.setAttribute('href', withBasePath(semControle));
    });
}

function ensureOwnerMonitorLinks(isOwner) {
    const navList = document.querySelector('.nav-list');
    if (!navList) return;

    const ownerEntries = [
        {
            key: 'owner-monitor-link',
            href: withBasePath('/monitoramento'),
            label: '🧪 Query Tool',
            legacySelector: 'a[href$="/monitoramento"], a[href="./monitoramento"]',
        },
        {
            key: 'owner-access-link',
            href: withBasePath('/monitoramento-acessos'),
            label: '🛰️ Últimos Acessos',
            legacySelector: 'a[href$="/monitoramento-acessos"], a[href="./monitoramento-acessos"]',
        },
    ];

    if (!isOwner) {
        const staleLinks = navList.querySelectorAll('.owner-monitor-link, .owner-access-link, li.owner-only a[href$="/monitoramento"], li.owner-only a[href="./monitoramento"], li.owner-only a[href$="/monitoramento-acessos"], li.owner-only a[href="./monitoramento-acessos"]');
        staleLinks.forEach((node) => {
            const item = node.tagName === 'LI' ? node : node.closest('li');
            if (item) item.remove();
        });
        return;
    }

    ownerEntries.forEach((entry) => {
        const legacyNode = navList.querySelector(entry.legacySelector);
        const existing = navList.querySelector(`.${entry.key}`) || (legacyNode ? legacyNode.closest('li') : null);
        const isActive = window.location.pathname === entry.href || window.location.pathname.endsWith(entry.href.replace(/^\/controle|^\/dev/, ''));

        if (existing) {
            existing.classList.add(entry.key);
            existing.classList.add('owner-only');
            const link = existing.querySelector('a');
            if (link) {
                link.setAttribute('href', entry.href);
                link.classList.toggle('active', isActive);
                link.textContent = entry.label;
            }
            return;
        }

        const li = document.createElement('li');
        li.className = `owner-only ${entry.key}`;

        const a = document.createElement('a');
        a.className = `nav-link${isActive ? ' active' : ''}`;
        a.href = entry.href;
        a.textContent = entry.label;

        li.appendChild(a);
        navList.appendChild(li);
    });
}

function injectUserDropdown(nome) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions || document.getElementById('userMenuDropdown')) return;

    const basePath = getAppBasePath();
    const perfilHref = basePath ? `${basePath}/perfil` : '/perfil';

    // Escapa o inicial para evitar XSS
    const raw = String(nome || 'U').charAt(0).toUpperCase();
    const inicial = raw.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Oculta o botão original — os scripts de cada página ainda o encontram pelo id
    const originalLogout = document.getElementById('btnLogout');
    if (originalLogout) originalLogout.style.display = 'none';

    const dropdown = document.createElement('div');
    dropdown.id = 'userMenuDropdown';
    dropdown.className = 'user-menu-dropdown';
    dropdown.innerHTML = `
        <button id="userMenuToggle" class="btn-user-menu" type="button" aria-label="Menu do usuário" aria-expanded="false">
            <span class="user-menu-inicial">${inicial}</span>
        </button>
        <div id="userMenuPanel" class="user-menu-panel" hidden>
            <a href="${perfilHref}" class="user-menu-item">
                <span class="material-icons">person</span> Meu Perfil
            </a>
            <button type="button" class="user-menu-item user-menu-logout">
                <span class="material-icons">logout</span> Sair
            </button>
        </div>
    `;

    headerActions.appendChild(dropdown);

    const toggle = document.getElementById('userMenuToggle');
    const panel = document.getElementById('userMenuPanel');
    const sairBtn = dropdown.querySelector('.user-menu-logout');

    if (toggle && panel) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !panel.hidden;
            panel.hidden = isOpen;
            toggle.setAttribute('aria-expanded', String(!isOpen));
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                panel.hidden = true;
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (sairBtn) {
        sairBtn.addEventListener('click', () => {
            const orig = document.getElementById('btnLogout');
            if (orig) orig.click();
        });
    }
}

function ensurePerfilLink() {
    // Mantida por compatibilidade — o perfil agora fica no dropdown de usuário
}

function ativarFallbackRotasNovas(closeMenu) {
    const fallbackRoute = withBasePath('/bioimpedancia');
    const candidatos = document.querySelectorAll('.nav-link[href$="/grupos-treino"], .nav-link[href$="/treinador"]');

    candidatos.forEach((link) => {
        link.addEventListener('click', async (event) => {
            const target = link.getAttribute('href');
            if (!target) return;

            event.preventDefault();
            if (typeof closeMenu === 'function') {
                closeMenu();
            }

            try {
                const probe = await fetch(target, {
                    method: 'HEAD',
                    credentials: 'include'
                });

                if (probe.ok || (probe.status >= 300 && probe.status < 400)) {
                    window.location.href = target;
                    return;
                }
            } catch (error) {
                console.warn('Rota ainda indisponivel, redirecionando para fallback:', error);
            }

            window.location.href = fallbackRoute;
        });
    });
}

async function aplicarPermissoesMenu() {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });

        if (!response.ok) return;

        const data = await response.json();
        const isMulher = (data?.sexo || '').toLowerCase() === 'feminino';
        const isTreinador = (data?.perfil || '').toLowerCase() === 'treinador';
        const isOwner = (data?.email || '').toLowerCase() === 'moisescamposdelfino@gmail.com';

        if (isTreinador) {
            document.body.classList.add('is-trainer');
        } else {
            document.body.classList.remove('is-trainer');
        }

        const trainerItems = document.querySelectorAll('.trainer-only');
        trainerItems.forEach((item) => {
            item.style.display = isTreinador ? '' : 'none';
        });

        ensureOwnerMonitorLinks(isOwner);
        injectUserDropdown(data.nome);

        if (!isMulher) return;

        const rankingLinks = document.querySelectorAll('.nav-link[href="/ranking"], .nav-link[href="/controle/ranking"], .nav-link[href$="/ranking"]');
        rankingLinks.forEach((link) => {
            const parent = link.closest('li');
            if (parent) {
                parent.style.display = 'none';
                return;
            }
            link.style.display = 'none';
        });
    } catch (error) {
        console.error('Erro ao aplicar permissões do menu:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    normalizarLinksMenu();

    const menuToggle = document.querySelector('.menu-toggle');
    const menuOverlay = document.querySelector('.menu-overlay');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Abrir/Fechar menu
    function toggleMenu() {
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        menuOverlay.classList.toggle('active');
        
        // Prevenir scroll do body quando menu aberto
        if (navMenu.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
    
    // Fechar menu
    function closeMenu() {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Event listeners
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMenu);
    }
    
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMenu);
    }
    
    // Fechar menu ao clicar em um link
    navLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    ativarFallbackRotasNovas(closeMenu);
    
    // Fechar menu ao pressionar ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });
    
    // Fechar menu ao redimensionar para desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    aplicarPermissoesMenu();
});
