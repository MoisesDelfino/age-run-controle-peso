// Configuração da API
var API_BASE = API_BASE || (window.location.pathname.startsWith('/dev') ? '/dev/api' : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

var usuarioLogado = usuarioLogado || null;

// Elementos DOM
const userNameSpan = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');
const homePesoPerdido = document.getElementById('homePesoPerdido');
const homeRankingPosicao = document.getElementById('homeRankingPosicao');
const homeRpsResumo = document.getElementById('homeRpsResumo');
const homeResumoAviso = document.getElementById('homeResumoAviso');
const homeRankingCard = document.getElementById('homeRankingCard');
const homeStatsIntro = document.getElementById('homeStatsIntro');
const homeStatsGrid = document.getElementById('homeStatsGrid');
const homeLevelItems = Array.from(document.querySelectorAll('.home-level-item'));

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

function formatPaceFromRace(totalSeconds, distanceKm) {
    const total = Number(totalSeconds);
    const distance = Number(distanceKm);

    if (!Number.isFinite(total) || !Number.isFinite(distance) || total <= 0 || distance <= 0) {
        return '-';
    }

    const paceSeconds = Math.round(total / distance);
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = paceSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}/km`;
}

function formatRpsResumo(rpsData) {
    const blocos = [
        {
            label: '5K',
            tempo: rpsData?.rp_5k_formatado || '-',
            pace: formatPaceFromRace(rpsData?.rp_5k, 5)
        },
        {
            label: '10K',
            tempo: rpsData?.rp_10k_formatado || '-',
            pace: formatPaceFromRace(rpsData?.rp_10k, 10)
        },
        {
            label: '21K',
            tempo: rpsData?.rp_21k_formatado || '-',
            pace: formatPaceFromRace(rpsData?.rp_21k, 21.0975)
        },
        {
            label: '42K',
            tempo: rpsData?.rp_42k_formatado || '-',
            pace: formatPaceFromRace(rpsData?.rp_42k, 42.195)
        }
    ];

    return blocos
        .map((bloco) => `
            <div class="home-rp-item">
                <span class="home-rp-distance">${bloco.label}</span>
                <strong class="home-rp-time">${bloco.tempo}</strong>
                <span class="home-rp-pace">Pace: ${bloco.pace}</span>
            </div>
        `)
        .join('');
}

function normalizeNivelLabel(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function stripPaceUnit(pace) {
    // formatPace returns "04:38 /km" — strip the " /km" suffix for range display
    return String(pace || '').replace(/\s*\/km\s*$/i, '').trim();
}

function marcarNivelAtual(gruposTiroData) {
    if (!homeLevelItems.length) {
        return;
    }

    const grupos = Array.isArray(gruposTiroData?.grupos) ? gruposTiroData.grupos : [];

    // Wrap bare text node in span so flex layout works correctly
    homeLevelItems.forEach((item) => {
        if (!item.querySelector('.home-level-label')) {
            const textNode = Array.from(item.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (textNode) {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'home-level-label';
                labelSpan.textContent = textNode.textContent;
                item.replaceChild(labelSpan, textNode);
            }
        }
    });

    // Reset e adicionar pace de referência de cada grupo
    homeLevelItems.forEach((item, index) => {
        item.classList.remove('home-level-item-current');
        item.querySelector('.home-level-tag')?.remove();
        item.querySelector('.home-level-pace')?.remove();

        const isLastItem = index === homeLevelItems.length - 1;
        let melhorPace = null;
        let piorPace = null;

        if (isLastItem && grupos.length > index) {
            const overflow = grupos.slice(index);
            melhorPace = overflow[0]?.melhor_pace_formatado || null;
            piorPace = overflow[overflow.length - 1]?.pior_pace_formatado || null;
        } else if (index < grupos.length) {
            melhorPace = grupos[index]?.melhor_pace_formatado || null;
            piorPace = grupos[index]?.pior_pace_formatado || null;
        }

        if (melhorPace) {
            const paceSpan = document.createElement('span');
            paceSpan.className = 'home-level-pace';
            const m = stripPaceUnit(melhorPace);
            const p = stripPaceUnit(piorPace);
            paceSpan.textContent = (p && p !== m) ? `${m} – ${p} /km` : `${m} /km`;
            item.appendChild(paceSpan);
        }
    });

    const nivelAtual = normalizeNivelLabel(gruposTiroData?.meu_grupo?.nome_nivel || '');
    if (!nivelAtual) {
        return;
    }

    const itemAtual = homeLevelItems.find((item) => {
        const nivelKey = normalizeNivelLabel(item.dataset.levelKey || '');
        return nivelKey !== '' && (nivelKey === nivelAtual || nivelAtual.includes(nivelKey) || nivelKey.includes(nivelAtual));
    }) || (nivelAtual !== '' ? homeLevelItems[homeLevelItems.length - 1] : null);

    if (!itemAtual) {
        return;
    }

    itemAtual.classList.add('home-level-item-current');
    const tag = document.createElement('span');
    tag.className = 'home-level-tag';
    tag.textContent = 'Nivel atual';
    itemAtual.appendChild(tag);
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
                ? 'Resumo com seu progresso atual, ranking e RPs.'
                : 'Resumo com seu progresso atual e RPs.';
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

        marcarNivelAtual(gruposTiroResp?.ok ? gruposTiroData : null);

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
