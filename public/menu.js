// ==================== CONTROLE DO MENU MOBILE ====================

var API_BASE = API_BASE || (window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port}/api`
    : '/api');

function getAppBasePath() {
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

async function aplicarPermissoesMenu() {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });

        if (!response.ok) return;

        const data = await response.json();
        const isMulher = (data?.sexo || '').toLowerCase() === 'feminino';
        const isTreinador = (data?.perfil || '').toLowerCase() === 'treinador';

        if (isTreinador) {
            document.body.classList.add('is-trainer');
        } else {
            document.body.classList.remove('is-trainer');
        }

        const trainerItems = document.querySelectorAll('.trainer-only');
        trainerItems.forEach((item) => {
            item.style.display = isTreinador ? '' : 'none';
        });

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
