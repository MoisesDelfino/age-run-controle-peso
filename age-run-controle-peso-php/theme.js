(function() {
    const THEME_STORAGE_KEY = 'agerun-theme';
    const DARK_CLASS = 'dark-mode';

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    window.AgeRunTheme = {
        applySavedTheme,
        toggleTheme
    };
})();
