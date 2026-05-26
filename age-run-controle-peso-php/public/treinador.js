var API_BASE = API_BASE || (window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port}/api`
    : '/api');

var usuarioLogado = usuarioLogado || null;

const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');
const coachPanelMessage = document.getElementById('coachPanelMessage');
const coachUsersContainer = document.getElementById('coachUsersContainer');
const coachSearchInput = document.getElementById('coachSearchInput');
const coachCounter = document.getElementById('coachCounter');
const kpiCards = Array.from(document.querySelectorAll('.coach-kpi-card[data-kpi-filter]'));
const kpiTotalUsuarios = document.getElementById('kpiTotalUsuarios');
const kpiPendentes = document.getElementById('kpiPendentes');
const kpiComBio = document.getElementById('kpiComBio');
const kpiSemRp = document.getElementById('kpiSemRp');
const coachGroupsSummary = document.getElementById('coachGroupsSummary');

let usuariosCache = [];
let termoBuscaAtual = '';
let expandedUserId = null;
let kpiFiltroAtual = 'ativos';

const provaLabels = {
    rp_5k: '5 km',
    rp_10k: '10 km',
    rp_21k: '21k',
    rp_42k: '42k'
};

const RACE_DISTANCES = {
    rp_5k: 5,
    rp_10k: 10,
    rp_21k: 21.0975,
    rp_42k: 42.195
};

const GROUP_COMPAT_THRESHOLD = 6;

function getStatusText(status) {
    if (status === 'pendente') return 'Aguardando aprovação';
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    return 'Sem RP';
}

function normalizeSearch(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getStatusClass(status) {
    if (status === 'pendente') return 'status-pendente';
    if (status === 'aprovado') return 'status-aprovado';
    if (status === 'reprovado') return 'status-reprovado';
    return 'status-sem-rp';
}

function formatNumero(value, suffix = '') {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '-';
    }
    return `${Number(value).toFixed(2)}${suffix}`;
}

function formatPace(secondsPerKm) {
    const parsed = Number(secondsPerKm);
    if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
        return '-';
    }

    const rounded = Math.round(parsed);
    const minutes = Math.floor(rounded / 60);
    const seconds = rounded % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} /km`;
}

function calcularScorePerformance(usuario) {
    const rps = usuario.rps || {};
    let somaPonderada = 0;
    let somaPesos = 0;

    Object.entries(RACE_DISTANCES).forEach(([column, distance]) => {
        const valor = Number(rps[column]);
        if (!valor || Number.isNaN(valor) || valor <= 0) {
            return;
        }

        const pace = valor / distance;
        somaPonderada += pace * distance;
        somaPesos += distance;
    });

    if (!somaPesos) {
        return null;
    }

    return somaPonderada / somaPesos;
}

function montarGruposTreinoResumo(usuarios) {
    const atletas = (usuarios || [])
        .map((usuario) => ({
            usuario,
            score: calcularScorePerformance(usuario)
        }))
        .filter((item) => item.score !== null)
        .sort((a, b) => a.score - b.score);

    if (!atletas.length) {
        return [];
    }

    const grupos = [];

    atletas.forEach((atleta) => {
        const grupoAtual = grupos[grupos.length - 1];

        if (!grupoAtual) {
            grupos.push({
                usuarios: [atleta],
                mediaScore: atleta.score
            });
            return;
        }

        const diffPercent = Math.abs(((atleta.score - grupoAtual.mediaScore) / grupoAtual.mediaScore) * 100);
        if (diffPercent <= GROUP_COMPAT_THRESHOLD) {
            grupoAtual.usuarios.push(atleta);
            const total = grupoAtual.usuarios.length;
            grupoAtual.mediaScore = ((grupoAtual.mediaScore * (total - 1)) + atleta.score) / total;
            return;
        }

        grupos.push({
            usuarios: [atleta],
            mediaScore: atleta.score
        });
    });

    return grupos.map((grupo, index) => {
        const scores = grupo.usuarios.map((item) => item.score).sort((a, b) => a - b);
        return {
            id: index + 1,
            mediaScore: grupo.mediaScore,
            melhorScore: scores[0],
            piorScore: scores[scores.length - 1],
            usuarios: grupo.usuarios.map((item) => item.usuario)
        };
    });
}

function renderResumoGruposTreino(usuarios) {
    if (!coachGroupsSummary) return;

    const grupos = montarGruposTreinoResumo(usuarios);

    if (!grupos.length) {
        coachGroupsSummary.innerHTML = '<p class="group-empty">Cadastre RPs para gerar sugestões de grupos com nomes.</p>';
        return;
    }

    coachGroupsSummary.innerHTML = grupos.map((grupo) => {
        const nomes = grupo.usuarios
            .map((usuario) => `<span class="coach-group-chip">${usuario.nome}</span>`)
            .join('');

        return `
            <article class="coach-group-card">
                <h4>Grupo ${grupo.id}</h4>
                <p class="group-meta">${grupo.usuarios.length} atleta(s) • Ritmo médio: ${formatPace(grupo.mediaScore)}</p>
                <p class="group-meta">Faixa: ${formatPace(grupo.melhorScore)} até ${formatPace(grupo.piorScore)}</p>
                <div class="coach-group-chips">${nomes}</div>
            </article>
        `;
    }).join('');
}

function getBioLine(label, value, suffix = '') {
    const formatted = value === null || value === undefined || value === ''
        ? '-'
        : `${value}${suffix}`;
    return `<span><strong>${label}:</strong> ${formatted}</span>`;
}

function calcularMetricasAvancadasUsuario(usuario) {
    const bio = usuario.bioimpedancia || {};
    const peso = Number(usuario.peso_atual);
    const altura = Number(usuario.altura);

    if (!peso || !altura || Number.isNaN(peso) || Number.isNaN(altura) || altura <= 0) {
        return null;
    }

    const gorduraPerc = parseFloat(bio.gordura_percentual) || 0;
    const massaMuscularPerc = parseFloat(bio.massa_muscular_percentual) || 0;
    const aguaPerc = parseFloat(bio.agua_percentual) || 0;
    const gorduraVisceral = parseFloat(bio.gordura_visceral) || 0;

    const massaGordaKg = (peso * gorduraPerc) / 100;
    const img = (massaGordaKg / (altura * altura)).toFixed(1);
    const massaMagraKg = peso - massaGordaKg;
    const ffmi = (massaMagraKg / (altura * altura)).toFixed(1);

    let classificacaoGordura, corGordura;
    if (gorduraPerc < 6) {
        classificacaoGordura = 'Essencial';
        corGordura = 'var(--secondary-light)';
    } else if (gorduraPerc < 14) {
        classificacaoGordura = 'Atlético';
        corGordura = 'var(--success-color)';
    } else if (gorduraPerc < 18) {
        classificacaoGordura = 'Fitness';
        corGordura = 'var(--accent-green)';
    } else if (gorduraPerc < 25) {
        classificacaoGordura = 'Aceitável';
        corGordura = 'var(--warning-color)';
    } else {
        classificacaoGordura = 'Alto';
        corGordura = 'var(--danger-color)';
    }

    let classificacaoFFMI, corFFMI;
    if (ffmi < 16) {
        classificacaoFFMI = 'Abaixo da média';
        corFFMI = 'var(--danger-color)';
    } else if (ffmi < 18) {
        classificacaoFFMI = 'Média';
        corFFMI = 'var(--warning-color)';
    } else if (ffmi < 20) {
        classificacaoFFMI = 'Acima da média';
        corFFMI = 'var(--accent-green)';
    } else if (ffmi < 22) {
        classificacaoFFMI = 'Superior';
        corFFMI = 'var(--success-color)';
    } else {
        classificacaoFFMI = 'Excepcional';
        corFFMI = 'var(--secondary-light)';
    }

    let classificacaoVisceral, corVisceral;
    if (gorduraVisceral < 10) {
        classificacaoVisceral = 'Saudável';
        corVisceral = 'var(--success-color)';
    } else if (gorduraVisceral < 15) {
        classificacaoVisceral = 'Elevado';
        corVisceral = 'var(--warning-color)';
    } else {
        classificacaoVisceral = 'Alto Risco';
        corVisceral = 'var(--danger-color)';
    }

    return {
        img,
        ffmi,
        massaGordaKg,
        massaMagraKg,
        gorduraPerc,
        massaMuscularPerc,
        aguaPerc,
        gorduraVisceral,
        classificacaoGordura,
        corGordura,
        classificacaoFFMI,
        corFFMI,
        classificacaoVisceral,
        corVisceral
    };
}

function calcularPainelImc(usuario) {
    const altura = Number(usuario.altura);
    const peso = Number(usuario.peso_atual);

    if (!altura || !peso || Number.isNaN(altura) || Number.isNaN(peso) || altura <= 0) {
        return null;
    }

    const imc = (peso / (altura * altura)).toFixed(1);
    let classificacao, cor, corHex;

    if (imc < 18.5) {
        classificacao = 'Baixo Peso';
        cor = 'var(--secondary-light)';
        corHex = '#9C27B0';
    } else if (imc < 25) {
        classificacao = 'Normal';
        cor = 'var(--success-color)';
        corHex = '#8BC34A';
    } else if (imc < 30) {
        classificacao = 'Sobrepeso';
        cor = 'var(--warning-color)';
        corHex = '#ff9800';
    } else if (imc < 35) {
        classificacao = 'Obesidade Grau I';
        cor = 'var(--danger-color)';
        corHex = '#f44336';
    } else if (imc < 40) {
        classificacao = 'Obesidade Grau II';
        cor = 'var(--danger-color)';
        corHex = '#f44336';
    } else {
        classificacao = 'Obesidade Grau III';
        cor = 'var(--secondary-color)';
        corHex = '#7B1FA2';
    }

    const pesoIdeal = (25 * altura * altura).toFixed(1);
    const diferenca = (peso - Number(pesoIdeal)).toFixed(1);
    const faltaPerder = parseFloat(diferenca);
    const progresso = faltaPerder > 0 ? Math.max(5, Math.min(100, 100 - (faltaPerder * 3.5))) : 100;

    return {
        altura,
        peso,
        imc,
        classificacao,
        cor,
        corHex,
        pesoIdeal,
        diferenca,
        progresso
    };
}

function renderAnaliseBioDoUsuario(usuario) {
    const imcData = calcularPainelImc(usuario);
    if (!imcData) {
        return '<p class="info-message">⚠️ Este usuário não possui altura e/ou peso suficientes para cálculo de IMC.</p>';
    }

    const bio = usuario.bioimpedancia || {};
    const temBioimpedancia = Object.values(bio).some((v) => v !== null && v !== undefined && v !== '');
    const tabScope = `coach-user-${usuario.usuario_id}`;

    if (!temBioimpedancia) {
        return `
            <div class="imc-card coach-imc-card">
                <div class="imc-header">
                    <div class="imc-value-circle" style="border-color: ${imcData.cor};">
                        <span class="imc-number">${imcData.imc}</span>
                        <span class="imc-label">IMC</span>
                    </div>
                    <div class="imc-classification">
                        <div class="classification-badge" style="background: ${imcData.cor}; color: white;">
                            ${imcData.classificacao}
                        </div>
                    </div>
                </div>

                <div class="imc-details-grid">
                    <div class="imc-detail-item">
                        <span class="imc-detail-icon">📏</span>
                        <div>
                            <span class="imc-detail-label">Altura:</span>
                            <span class="imc-detail-value">${imcData.altura.toFixed(2)} m</span>
                        </div>
                    </div>
                    <div class="imc-detail-item">
                        <span class="imc-detail-icon">⚖️</span>
                        <div>
                            <span class="imc-detail-label">Peso atual:</span>
                            <span class="imc-detail-value">${imcData.peso.toFixed(1)} kg</span>
                        </div>
                    </div>
                    <div class="imc-detail-item">
                        <span class="imc-detail-icon">🎯</span>
                        <div>
                            <span class="imc-detail-label">Peso ideal:</span>
                            <span class="imc-detail-value">${imcData.pesoIdeal} kg</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    const m = calcularMetricasAvancadasUsuario(usuario);

    return `
        <div class="analysis-tabs-container coach-health-tabs" data-tab-scope="${tabScope}">
            <div class="analysis-tabs">
                <button class="tab-btn coach-tab-btn active" data-tab-scope="${tabScope}" data-tab="imc">📊 IMC Tradicional</button>
                <button class="tab-btn coach-tab-btn" data-tab-scope="${tabScope}" data-tab="avancado">🔬 Análise Avançada</button>
            </div>

            <div class="tab-content active" data-tab-scope="${tabScope}" data-tab-content="imc">
                <div class="imc-card coach-imc-card">
                    <div class="imc-header">
                        <div class="imc-value-circle" style="border-color: ${imcData.cor};">
                            <span class="imc-number">${imcData.imc}</span>
                            <span class="imc-label">IMC</span>
                        </div>
                        <div class="imc-classification">
                            <div class="classification-badge" style="background: ${imcData.cor}; color: white;">
                                ${imcData.classificacao}
                            </div>
                        </div>
                    </div>

                    <div class="imc-details-grid">
                        <div class="imc-detail-item">
                            <span class="imc-detail-icon">📏</span>
                            <div>
                                <span class="imc-detail-label">Altura:</span>
                                <span class="imc-detail-value">${imcData.altura.toFixed(2)} m</span>
                            </div>
                        </div>
                        <div class="imc-detail-item">
                            <span class="imc-detail-icon">⚖️</span>
                            <div>
                                <span class="imc-detail-label">Peso atual:</span>
                                <span class="imc-detail-value">${imcData.peso.toFixed(1)} kg</span>
                            </div>
                        </div>
                        <div class="imc-detail-item">
                            <span class="imc-detail-icon">🎯</span>
                            <div>
                                <span class="imc-detail-label">Peso ideal:</span>
                                <span class="imc-detail-value">${imcData.pesoIdeal} kg</span>
                            </div>
                        </div>
                    </div>

                    ${Number(imcData.diferenca) > 0 ? `
                    <div class="imc-progress-section">
                        <h4 class="progress-title">Progresso para IMC Saudável</h4>
                        <div class="progress-bar-wrapper">
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: ${imcData.progresso}%; background: linear-gradient(90deg, ${imcData.corHex}, ${imcData.corHex}dd);">
                                    <span class="progress-percentage">${imcData.progresso.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="tab-content" data-tab-scope="${tabScope}" data-tab-content="avancado">
                <div class="advanced-metrics-grid">
                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-icon">💧</span>
                            <h3>IMG - Índice de Massa Gorda</h3>
                        </div>
                        <div class="metric-value-circle" style="border-color: ${m.corGordura};">
                            <span class="metric-number">${m.img}</span>
                            <span class="metric-unit">kg/m²</span>
                        </div>
                        <div class="metric-badge" style="background: ${m.corGordura};">
                            ${m.classificacaoGordura}
                        </div>
                        <div class="metric-detail">
                            <p>📊 Gordura corporal: <strong>${m.gorduraPerc.toFixed(1)}%</strong></p>
                            <p>⚖️ Massa gorda: <strong>${m.massaGordaKg.toFixed(1)} kg</strong></p>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-icon">💪</span>
                            <h3>FFMI - Índice de Massa Magra</h3>
                        </div>
                        <div class="metric-value-circle" style="border-color: ${m.corFFMI};">
                            <span class="metric-number">${m.ffmi}</span>
                            <span class="metric-unit">kg/m²</span>
                        </div>
                        <div class="metric-badge" style="background: ${m.corFFMI};">
                            ${m.classificacaoFFMI}
                        </div>
                        <div class="metric-detail">
                            <p>💪 Massa muscular: <strong>${m.massaMuscularPerc.toFixed(1)}%</strong></p>
                            <p>⚖️ Massa magra: <strong>${m.massaMagraKg.toFixed(1)} kg</strong></p>
                        </div>
                    </div>

                    <div class="metric-card full-width">
                        <div class="metric-header">
                            <span class="metric-icon">📊</span>
                            <h3>Composição Corporal Detalhada</h3>
                        </div>
                        <div class="composition-bars">
                            <div class="composition-item">
                                <div class="composition-label">
                                    <span>💪 Massa Muscular</span>
                                    <strong>${m.massaMuscularPerc.toFixed(1)}%</strong>
                                </div>
                                <div class="composition-bar-bg">
                                    <div class="composition-bar" style="width: ${m.massaMuscularPerc}%; background: var(--success-color);"></div>
                                </div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">
                                    <span>💧 Gordura Corporal</span>
                                    <strong>${m.gorduraPerc.toFixed(1)}%</strong>
                                </div>
                                <div class="composition-bar-bg">
                                    <div class="composition-bar" style="width: ${m.gorduraPerc}%; background: ${m.corGordura};"></div>
                                </div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">
                                    <span>💦 Água Corporal</span>
                                    <strong>${m.aguaPerc.toFixed(1)}%</strong>
                                </div>
                                <div class="composition-bar-bg">
                                    <div class="composition-bar" style="width: ${m.aguaPerc}%; background: var(--secondary-light);"></div>
                                </div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">
                                    <span>🫀 Gordura Visceral</span>
                                    <strong>Nível ${m.gorduraVisceral.toFixed(0)}</strong>
                                </div>
                                <div class="composition-bar-bg">
                                    <div class="composition-bar" style="width: ${Math.min(m.gorduraVisceral * 3.33, 100)}%; background: ${m.corVisceral};"></div>
                                </div>
                                <span class="composition-status" style="color: ${m.corVisceral};">${m.classificacaoVisceral}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getPendenciasUsuario(usuario) {
    const rps = usuario.rps || {};
    const provas = ['rp_5k', 'rp_10k', 'rp_21k', 'rp_42k'];
    return provas.filter((prova) => {
        const valor = rps[prova];
        const status = rps[`${prova}_status`] || null;
        return valor !== null && valor !== undefined && status === 'pendente';
    }).length;
}

function usuarioTemRp(usuario) {
    const rps = usuario.rps || {};
    return ['rp_5k', 'rp_10k', 'rp_21k', 'rp_42k'].some((prova) => rps[prova] !== null && rps[prova] !== undefined);
}

function usuarioTemBio(usuario) {
    const bio = usuario.bioimpedancia || {};
    return Object.values(bio).some((value) => value !== null && value !== undefined && value !== '');
}

function atualizarKpis(usuarios) {
    const lista = usuarios || [];
    const total = lista.length;
    const pendentes = lista.reduce((acc, usuario) => acc + getPendenciasUsuario(usuario), 0);
    const comBio = lista.filter(usuarioTemBio).length;
    const semRp = lista.filter((usuario) => !usuarioTemRp(usuario)).length;

    if (kpiTotalUsuarios) kpiTotalUsuarios.textContent = String(total);
    if (kpiPendentes) kpiPendentes.textContent = String(pendentes);
    if (kpiComBio) kpiComBio.textContent = String(comBio);
    if (kpiSemRp) kpiSemRp.textContent = String(semRp);
}

function filtrarPorKpi(usuarios) {
    if (kpiFiltroAtual === 'pendentes') {
        return usuarios.filter((usuario) => getPendenciasUsuario(usuario) > 0);
    }

    if (kpiFiltroAtual === 'combio') {
        return usuarios.filter((usuario) => usuarioTemBio(usuario));
    }

    if (kpiFiltroAtual === 'semrp') {
        return usuarios.filter((usuario) => !usuarioTemRp(usuario));
    }

    return usuarios;
}

function atualizarEstadoKpiCards() {
    kpiCards.forEach((card) => {
        const isActive = card.getAttribute('data-kpi-filter') === kpiFiltroAtual;
        card.classList.toggle('active', isActive);
        card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

async function verificarSessao(tentativas = 3) {
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.authenticated) {
            if (tentativas > 0) {
                await new Promise(resolve => setTimeout(resolve, 400));
                return verificarSessao(tentativas - 1);
            }

            window.location.href = '/controle/login';
            return false;
        }

        if ((data.perfil || '').toLowerCase() !== 'treinador') {
            window.location.href = '/controle/home';
            return false;
        }

        usuarioLogado = data;
        if (userNameSpan) {
            userNameSpan.textContent = data.nome?.split(' ')[0] || '';
        }

        return true;
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        if (tentativas > 0) {
            await new Promise(resolve => setTimeout(resolve, 400));
            return verificarSessao(tentativas - 1);
        }

        window.location.href = '/controle/login';
        return false;
    }
}

function renderCoachRps(usuario) {
    const rps = usuario.rps || {};
    const provas = ['rp_5k', 'rp_10k', 'rp_21k', 'rp_42k'];

    return provas.map((prova) => {
        const formatado = rps[`${prova}_formatado`] || '-';
        const valor = rps[prova];
        const status = rps[`${prova}_status`] || null;
        const normalized = valor === null || valor === undefined ? null : status || 'pendente';
        const temRp = valor !== null && valor !== undefined;

        const actionsHtml = temRp
            ? `
                <div class="coach-rp-actions">
                    <button class="btn btn-secondary coach-rp-action" data-user-id="${usuario.usuario_id}" data-prova="${prova}" data-status="aprovado">Aprovar</button>
                    <button class="btn coach-rp-action coach-reprove" data-user-id="${usuario.usuario_id}" data-prova="${prova}" data-status="reprovado">Reprovar</button>
                </div>
            `
            : '<div class="group-meta">Sem RP cadastrado para esta prova.</div>';

        return `
            <div class="coach-rp-item">
                <div class="coach-rp-header">
                    <span class="coach-rp-title">${provaLabels[prova]}: ${formatado}</span>
                    <span class="rp-status-badge ${getStatusClass(normalized)}">${getStatusText(normalized)}</span>
                </div>
                ${actionsHtml}
            </div>
        `;
    }).join('');
}

function renderCoachSummary(usuario, expanded) {
    const pendencias = getPendenciasUsuario(usuario);
    const pendenciaChip = pendencias > 0
        ? `<span class="coach-pending-chip">${pendencias} pendência(s)</span>`
        : '<span class="coach-pending-chip coach-pending-ok">Sem pendências</span>';

    return `
        <button class="coach-user-summary" data-user-id="${usuario.usuario_id}" aria-expanded="${expanded ? 'true' : 'false'}">
            <div class="coach-summary-main">
                <strong>${usuario.nome}</strong>
                <span class="coach-summary-email">${usuario.email || '-'}</span>
                ${pendenciaChip}
            </div>
            <div class="coach-summary-metrics">
                <span>IMC: ${formatNumero(usuario.imc)}</span>
                <span>Peso: ${formatNumero(usuario.peso_atual, ' kg')}</span>
                <span>Altura: ${formatNumero(usuario.altura, ' m')}</span>
            </div>
            <span class="coach-summary-chevron">${expanded ? '▲' : '▼'}</span>
        </button>
    `;
}

function renderCoachDetails(usuario) {
    return `
        <div class="coach-user-details">
            <div class="coach-health-panel">
                ${renderAnaliseBioDoUsuario(usuario)}
            </div>
            <div class="coach-rp-list">
                ${renderCoachRps(usuario)}
            </div>
        </div>
    `;
}

function renderCoachUsers(usuarios) {
    if (!coachUsersContainer) return;

    if (!usuarios || !usuarios.length) {
        coachUsersContainer.innerHTML = '<p class="group-empty">Nenhum usuário ativo encontrado.</p>';
        if (coachCounter) {
            coachCounter.textContent = '0 resultados';
        }
        return;
    }

    if (coachCounter) {
        const total = usuariosCache.length;
        const filtrados = usuarios.length;
        coachCounter.textContent = termoBuscaAtual
            ? `${filtrados} de ${total} usuários`
            : `${total} usuários`;
    }

    coachUsersContainer.innerHTML = usuarios.map((usuario) => {
        const expanded = Number(expandedUserId) === Number(usuario.usuario_id);
        return `
            <article class="coach-user-accordion ${expanded ? 'expanded' : ''}" data-user-id="${usuario.usuario_id}">
                ${renderCoachSummary(usuario, expanded)}
                ${renderCoachDetails(usuario)}
            </article>
        `;
    }).join('');
}

function filtrarUsuarios() {
    let base = filtrarPorKpi(usuariosCache);

    const termo = normalizeSearch(termoBuscaAtual);
    if (!termo) {
        renderCoachUsers(base);
        return;
    }

    const filtrados = base.filter((usuario) => {
        const nome = normalizeSearch(usuario.nome);
        const email = normalizeSearch(usuario.email);
        return nome.includes(termo) || email.includes(termo);
    });

    renderCoachUsers(filtrados);
}

async function carregarPainelTreinador() {
    try {
        const response = await fetch(`${API_BASE}/treinador/usuarios-ativos`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar painel do treinador');
        }

        usuariosCache = (data.usuarios || []).sort((a, b) => {
            const pa = getPendenciasUsuario(a);
            const pb = getPendenciasUsuario(b);
            if (pb !== pa) return pb - pa;
            return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });

        atualizarKpis(usuariosCache);
        renderResumoGruposTreino(usuariosCache);

        if (coachPanelMessage) {
            coachPanelMessage.textContent = `Usuários ativos carregados: ${usuariosCache.length}`;
        }
        filtrarUsuarios();
    } catch (error) {
        console.error('Erro ao carregar painel do treinador:', error);
        if (coachPanelMessage) {
            coachPanelMessage.textContent = `Erro ao carregar dados: ${error.message}`;
        }
    }
}

async function atualizarStatusRpTreinador(usuarioId, prova, status) {
    try {
        const response = await fetch(`${API_BASE}/treinador/rps/${usuarioId}/aprovacao`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ prova, status })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao atualizar status de RP');
        }

        if (coachPanelMessage) {
            coachPanelMessage.textContent = `Status atualizado: ${provaLabels[prova]} do usuário #${usuarioId} => ${getStatusText(status)}`;
        }

        await carregarPainelTreinador();
    } catch (error) {
        console.error('Erro ao atualizar status de RP:', error);
        if (coachPanelMessage) {
            coachPanelMessage.textContent = `Erro: ${error.message}`;
        }
    }
}

async function handleLogout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            setTimeout(() => {
                window.location.href = '/controle/login';
            }, 100);
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const ok = await verificarSessao();
    if (ok) {
        await carregarPainelTreinador();
    }
});

if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

if (coachUsersContainer) {
    coachUsersContainer.addEventListener('click', (event) => {
        const tabButton = event.target.closest('.coach-tab-btn');
        if (tabButton) {
            event.preventDefault();
            event.stopPropagation();

            const scope = tabButton.getAttribute('data-tab-scope');
            const targetTab = tabButton.getAttribute('data-tab');
            if (!scope || !targetTab) return;

            const scopeContainer = tabButton.closest('.analysis-tabs-container');
            if (!scopeContainer) return;

            const tabs = scopeContainer.querySelectorAll(`.coach-tab-btn[data-tab-scope="${scope}"]`);
            const contents = scopeContainer.querySelectorAll(`.tab-content[data-tab-scope="${scope}"]`);

            tabs.forEach((tab) => tab.classList.remove('active'));
            contents.forEach((content) => content.classList.remove('active'));

            tabButton.classList.add('active');
            const content = scopeContainer.querySelector(`.tab-content[data-tab-scope="${scope}"][data-tab-content="${targetTab}"]`);
            if (content) {
                content.classList.add('active');
            }
            return;
        }

        const button = event.target.closest('.coach-rp-action');
        if (button) {
            event.preventDefault();

            const usuarioId = button.getAttribute('data-user-id');
            const prova = button.getAttribute('data-prova');
            const status = button.getAttribute('data-status');

            if (!usuarioId || !prova || !status) return;
            atualizarStatusRpTreinador(usuarioId, prova, status);
            return;
        }

        const summary = event.target.closest('.coach-user-summary');
        if (!summary) return;

        event.preventDefault();
        const usuarioId = Number(summary.getAttribute('data-user-id'));
        expandedUserId = Number(expandedUserId) === usuarioId ? null : usuarioId;
        filtrarUsuarios();
    });
}

if (coachSearchInput) {
    coachSearchInput.addEventListener('input', (event) => {
        termoBuscaAtual = event.target.value || '';
        filtrarUsuarios();
    });
}

if (kpiCards.length) {
    kpiCards.forEach((card) => {
        card.addEventListener('click', () => {
            const nextFilter = card.getAttribute('data-kpi-filter') || 'ativos';
            kpiFiltroAtual = nextFilter;
            atualizarEstadoKpiCards();
            expandedUserId = null;
            filtrarUsuarios();
        });
    });
    atualizarEstadoKpiCards();
}
