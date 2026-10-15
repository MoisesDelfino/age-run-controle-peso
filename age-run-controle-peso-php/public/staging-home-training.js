(function initStagingHomeTraining() {
    if (!(window.location.pathname === '/dev/home' || window.location.pathname === '/dev/home/')) return;

    const apiBase = '/dev/api';
    const rpFields = [
        { key: '5k', apiKey: 'rp_5k', distance: 5 },
        { key: '10k', apiKey: 'rp_10k', distance: 10 },
        { key: '21k', apiKey: 'rp_21k', distance: 21.0975 },
        { key: '42k', apiKey: 'rp_42k', distance: 42.195 }
    ];

    const parseTime = (value) => {
        const parts = String(value || '').trim().split(':').map(Number);
        if ((parts.length !== 2 && parts.length !== 3) || parts.some(Number.isNaN)) return null;
        return parts.length === 2
            ? parts[0] * 60 + parts[1]
            : parts[0] * 3600 + parts[1] * 60 + parts[2];
    };

    const formatPace = (seconds, distance) => {
        if (!seconds || !distance) return '';
        const pace = Math.round(seconds / distance);
        return `${String(Math.floor(pace / 60)).padStart(2, '0')}:${String(pace % 60).padStart(2, '0')} /km`;
    };

    const showMessage = (element, text, type) => {
        if (!element) return;
        element.textContent = text;
        element.className = `message ${type || 'info'}`;
        element.style.display = 'block';
    };

    const formatDate = (value) => {
        const raw = String(value || '').slice(0, 10);
        const parts = raw.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : raw || '-';
    };

    const renderTestHistory = (tests, fallbackTest) => {
        const target = document.getElementById('homeAthleteLastTest');
        if (!target) return;
        const history = Array.isArray(tests) && tests.length ? tests : (fallbackTest ? [fallbackTest] : []);
        if (!history.length) {
            target.innerHTML = '<p class="group-meta coach-rp-test-empty">Nenhum teste registrado ainda.</p>';
            return;
        }

        target.innerHTML = `
            <div class="staging-test-history-title">Histórico de testes</div>
            ${history.map((test) => `
                <article class="coach-rp-test-history-item">
                    <div class="coach-rp-test-chip-row">
                        <strong class="coach-rp-test-chip">${test.tempo_formatado || '-'}</strong>
                        <span class="coach-rp-test-chip">${Number(test.distancia_km || 0).toLocaleString('pt-BR')} km</span>
                        <span class="coach-rp-test-chip coach-rp-test-chip-accent">${test.pace_formatado || '-'}</span>
                    </div>
                    <div class="coach-rp-test-meta-row"><span>${test.criado_em_formatado || formatDate(test.criado_em)}</span></div>
                </article>`).join('')}`;
    };

    const loadRecords = async () => {
        try {
            const response = await fetch(`${apiBase}/performance/rps`, { credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao carregar recordes');

            rpFields.forEach((field) => {
                const input = document.getElementById(`homeRp${field.key}`);
                const pace = document.getElementById(`homePaceRp${field.key}`);
                const status = document.getElementById(`homeStatusRp${field.key}`);
                const seconds = Number(data[field.apiKey]);
                if (input) input.value = data[`${field.apiKey}_formatado`] || '';
                if (pace) pace.textContent = Number.isFinite(seconds) && seconds > 0 ? formatPace(seconds, field.distance) : '';
                if (status) {
                    const state = data[`${field.apiKey}_status`] || (seconds > 0 ? 'pendente' : null);
                    status.className = `rp-status-badge status-${state || 'sem-rp'}`;
                    status.textContent = state === 'aprovado' ? 'Aprovado' : state === 'reprovado' ? 'Reprovado' : state === 'pendente' ? 'Aguardando' : 'Sem RP';
                }
            });

            const summary = document.getElementById('homeRpPaceSummary');
            if (summary) summary.textContent = data.ritmo_medio_formatado ? `Ritmo médio: ${data.ritmo_medio_formatado}` : '';
            renderTestHistory(data.historico_testes, data.ultimo_teste);
        } catch (error) {
            showMessage(document.getElementById('homeRpMessage'), error.message, 'error');
        }
    };

    const rpForm = document.getElementById('homeRpForm');
    rpForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {};
        rpFields.forEach((field) => {
            payload[field.apiKey] = document.getElementById(`homeRp${field.key}`)?.value.trim() || null;
        });
        try {
            const response = await fetch(`${apiBase}/performance/rps`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao salvar recordes');
            showMessage(document.getElementById('homeRpMessage'), 'Recordes salvos com sucesso.', 'success');
            await loadRecords();
        } catch (error) {
            showMessage(document.getElementById('homeRpMessage'), error.message, 'error');
        }
    });

    const testForm = document.getElementById('homeAthleteTestForm');
    const testFormToggle = document.getElementById('homeTestFormToggle');
    const testFormCancel = document.getElementById('homeTestFormCancel');
    const testTime = document.getElementById('homeAthleteTestTime');
    const testDistance = document.getElementById('homeAthleteTestDistance');
    const testDate = document.getElementById('homeAthleteTestDate');
    const testPace = document.getElementById('homeAthleteTestPace');
    const testHistory = document.getElementById('homeAthleteLastTest');
    const testCard = testForm?.closest('.staging-home-training-card');

    const setTestFormOpen = (open) => {
        if (!testForm || !testFormToggle) return;
        testForm.hidden = !open;
        testForm.classList.toggle('is-open', open);
        testFormToggle.setAttribute('aria-expanded', String(open));
        testFormToggle.classList.toggle('is-open', open);
        testCard?.classList.toggle('is-test-form-open', open);
        testHistory?.setAttribute('aria-hidden', String(open));
        testFormToggle.querySelector('.material-icons').textContent = open ? 'close' : 'add';
        testFormToggle.querySelector('span:last-child').textContent = open ? 'Fechar cadastro' : 'Cadastrar teste';
        if (open) testTime?.focus();
    };

    const updateTestPace = () => {
        const seconds = parseTime(testTime?.value);
        const distance = Number(testDistance?.value);
        if (testPace) testPace.textContent = seconds && distance > 0 ? `Pace: ${formatPace(seconds, distance)}` : 'Pace: -';
    };

    if (testDate && !testDate.value) testDate.value = new Date().toLocaleDateString('en-CA');
    testFormToggle?.addEventListener('click', () => setTestFormOpen(testForm?.hidden !== false));
    testFormCancel?.addEventListener('click', () => setTestFormOpen(false));
    testTime?.addEventListener('input', updateTestPace);
    testDistance?.addEventListener('input', updateTestPace);
    testForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const seconds = parseTime(testTime?.value);
        const distance = Number(testDistance?.value);
        if (!seconds || !distance || !testDate?.value) {
            showMessage(document.getElementById('homeAthleteTestMessage'), 'Preencha tempo, distância e data.', 'error');
            return;
        }
        try {
            const response = await fetch(`${apiBase}/performance/testes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tempo: testTime.value.trim(), distancia_km: distance, criado_em: testDate.value })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao salvar teste');
            showMessage(document.getElementById('homeAthleteTestMessage'), 'Teste salvo com sucesso.', 'success');
            testTime.value = '';
            testDistance.value = '';
            updateTestPace();
            await loadRecords();
            setTestFormOpen(false);
        } catch (error) {
            showMessage(document.getElementById('homeAthleteTestMessage'), error.message, 'error');
        }
    });

    loadRecords();
})();
