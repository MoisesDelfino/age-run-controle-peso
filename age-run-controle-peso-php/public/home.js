// Configuração da API
var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

var usuarioLogado = usuarioLogado || null;

// Elementos DOM
const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');
const homePesoPerdido = document.getElementById('homePesoPerdido');
const homeRankingPosicao = document.getElementById('homeRankingPosicao');
const homeRpsResumo = document.getElementById('homeRpsResumo');
const homeGrupoTiroResumo = document.getElementById('homeGrupoTiroResumo');
const homeResumoAviso = document.getElementById('homeResumoAviso');
const homeRankingCard = document.getElementById('homeRankingCard');
const homeStatsIntro = document.getElementById('homeStatsIntro');
const homeStatsGrid = document.getElementById('homeStatsGrid');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    const authenticated = await verificarSessao();
    if (authenticated) {
        await carregarResumoHome();
    }
});

// ==================== AUTENTICAÇÃO ====================

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

            window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            return false;
        }
        
        usuarioLogado = data;
        // Extrair apenas o primeiro nome
        const primeiroNome = usuarioLogado.nome?.split(' ')[0] || '';
        if (userNameSpan) {
            userNameSpan.textContent = primeiroNome;
        }

        return true;
        
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        if (tentativas > 0) {
            await new Promise(resolve => setTimeout(resolve, 400));
            return verificarSessao(tentativas - 1);
        }

        window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
        return false;
    }
}

function formatPeso(value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return '-';
    }

    return `${parsed.toFixed(2).replace('.', ',')} kg`;
}

function formatRpsResumo(rpsData) {
    const blocos = [
        ['5K', rpsData?.rp_5k_formatado || '-'],
        ['10K', rpsData?.rp_10k_formatado || '-'],
        ['21K', rpsData?.rp_21k_formatado || '-'],
        ['42K', rpsData?.rp_42k_formatado || '-']
    ];

    return blocos
        .map(([label, value]) => `
            <div class="home-rp-item">
                <span class="home-rp-distance">${label}</span>
                <strong class="home-rp-time">${value}</strong>
            </div>
        `)
        .join('');
}

function formatGrupoTiroResumo(gruposTiroData) {
    const grupo = gruposTiroData?.meu_grupo;
    if (!grupo) {
        return '-';
    }

    const nome = grupo.nome_nivel || 'Grupo de tiro';
    const melhor = grupo.melhor_pace_formatado || '-';
    const pior = grupo.pior_pace_formatado || '-';
    return `${nome} (${melhor} a ${pior})`;
}

function findMinhaPosicaoRanking(rankingData) {
    const lista = Array.isArray(rankingData?.ranking) ? rankingData.ranking : [];
    const meuId = Number(usuarioLogado?.id || 0);
    const item = lista.find((row) => Number(row?.usuario_id || 0) === meuId);
    return item?.posicao || null;
}

async function carregarResumoHome() {
    if (!usuarioLogado || !usuarioLogado.id) {
        return;
    }

    if (homeResumoAviso) {
        homeResumoAviso.textContent = 'Carregando seus dados...';
    }

    try {
        const usuarioId = Number(usuarioLogado.id);
        const sexo = String(usuarioLogado.sexo || '').toLowerCase();
        const isMasculino = sexo === 'masculino';

        if (homeRankingCard) {
            homeRankingCard.style.display = isMasculino ? '' : 'none';
        }

        if (homeStatsGrid) {
            homeStatsGrid.classList.toggle('home-stats-grid-no-ranking', !isMasculino);
        }

        if (homeStatsIntro) {
            homeStatsIntro.textContent = isMasculino
                ? 'Resumo com seu progresso atual, ranking, RPs e grupo de tiros.'
                : 'Resumo com seu progresso atual, RPs e grupo de tiros.';
        }

        const [pesagensResp, rpsResp, gruposTiroResp, rankingResp] = await Promise.all([
            fetch(`${API_BASE}/pesagens/usuario/${usuarioId}`, { credentials: 'include' }),
            fetch(`${API_BASE}/performance/rps`, { credentials: 'include' }),
            fetch(`${API_BASE}/performance/grupos-tiro`, { credentials: 'include' }),
            isMasculino
                ? fetch(`${API_BASE}/ranking`, { credentials: 'include' })
                : Promise.resolve(null)
        ]);

        const pesagensData = pesagensResp ? await pesagensResp.json() : {};
        const rpsData = rpsResp ? await rpsResp.json() : {};
        const gruposTiroData = gruposTiroResp ? await gruposTiroResp.json() : {};
        const rankingData = rankingResp ? await rankingResp.json() : null;

        const pesagens = Array.isArray(pesagensData?.pesagens) ? pesagensData.pesagens : [];
        let pesoPerdido = 0;
        if (pesagens.length >= 2) {
            const pesoAtual = Number(pesagens[0]?.peso);
            const pesoInicial = Number(pesagens[pesagens.length - 1]?.peso);
            if (!Number.isNaN(pesoAtual) && !Number.isNaN(pesoInicial)) {
                pesoPerdido = Math.max(0, pesoInicial - pesoAtual);
            }
        }

        if (homePesoPerdido) {
            homePesoPerdido.textContent = formatPeso(pesoPerdido);
        }

        if (homeRankingPosicao) {
            if (isMasculino) {
                const minhaPosicao = rankingResp?.ok ? findMinhaPosicaoRanking(rankingData) : null;
                homeRankingPosicao.textContent = minhaPosicao ? `#${minhaPosicao}` : '-';
            }
        }

        if (homeRpsResumo) {
            homeRpsResumo.innerHTML = formatRpsResumo(rpsResp?.ok ? rpsData : null);
        }

        if (homeGrupoTiroResumo) {
            homeGrupoTiroResumo.textContent = gruposTiroResp?.ok
                ? formatGrupoTiroResumo(gruposTiroData)
                : '-';
        }

        if (homeResumoAviso) {
            const avisos = [];
            if (gruposTiroData?.aviso) {
                avisos.push(gruposTiroData.aviso);
            }
            homeResumoAviso.textContent = avisos.join(' ');
        }
    } catch (error) {
        console.error('Erro ao carregar resumo da home:', error);
        if (homeResumoAviso) {
            homeResumoAviso.textContent = `Nao foi possivel carregar todos os dados: ${error.message}`;
        }
    }
}

async function handleLogout() {
    try {
        console.log('Botão logout clicado');
        console.log('handleLogout chamado');
        
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        console.log('Resposta do logout:', response.status);
        
        if (response.ok) {
            console.log('Logout bem-sucedido, redirecionando...');
            setTimeout(() => {
                console.log('Redirecionando para /login');
                window.location.href = (window.location.pathname.startsWith('/dev') ? '/dev/login' : '/controle/login');
            }, 100);
        } else {
            console.error('Erro no logout:', response.status);
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// Event Listeners
if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
    console.log('Botão logout encontrado');
}
