// ==================== CONTROLE DO MENU MOBILE ====================

var API_BASE = API_BASE || (window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port}/api`
    : '/controle/api');

async function aplicarPermissoesMenu() {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });

        if (!response.ok) return;

        const data = await response.json();
        const isMulher = (data?.sexo || '').toLowerCase() === 'feminino';

        if (!isMulher) return;

        const rankingLinks = document.querySelectorAll('.nav-link[href="/controle/ranking"], .nav-link[href$="/ranking"]');
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
