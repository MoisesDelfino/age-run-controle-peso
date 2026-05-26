// bioimpedancia.js - Versão Simplificada (Formulário Manual)
// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Carregar nome do usuário e IMC
    await carregarNomeUsuario();
    
    // Carregar histórico de bioimpedância
    await carregarHistoricoBio();
    
    // Event listeners
    setupEventListeners();
    
    // Atualizar IMC quando a página recebe foco (usuário voltou da aba de pesagem)
    window.addEventListener('focus', async () => {
        console.log('🔄 Página recebeu foco, recarregando dados...');
        await carregarNomeUsuario();
        // Verificar se a altura foi recentemente atualizada
        const alturaAtualizadaTimestamp = localStorage.getItem('altura_atualizada');
        if (alturaAtualizadaTimestamp) {
            const tempoDecorrido = Date.now() - parseInt(alturaAtualizadaTimestamp);
            // Se foi atualizada nos últimos 5 segundos, mostrar notificação
            if (tempoDecorrido < 5000) {
                console.log('✅ Altura foi recentemente atualizada, IMC recalculado!');
                mostrarNotificacao('✅ IMC atualizado com a nova altura!', 'success');
            }
        }
    });
    
    // Detectar quando altura é atualizada em outra aba
    window.addEventListener('storage', async (e) => {
        if (e.key === 'altura_atualizada') {
            console.log('🔄 Altura atualizada em outra aba, recarregando IMC...');
            await carregarNomeUsuario();
            mostrarNotificacao('✅ IMC atualizado com a nova altura!', 'success');
        }
    });
});

// Setup de event listeners
function setupEventListeners() {
    // Formulário de bioimpedância
    document.getElementById('formBioimpedancia').addEventListener('submit', salvarBioimpedancia);
    
    // Botão limpar formulário
    document.getElementById('btnLimparForm').addEventListener('click', limparFormulario);
}

// Carregar nome do usuário e calcular IMC
async function carregarNomeUsuario() {
    console.log('🔍 Carregando dados do usuário...');
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (response.ok) {
            const usuario = await response.json();
            console.log('✅ Usuário carregado:', usuario);
            
            // Extrair primeiro nome
            const primeiroNome = usuario.nome ? usuario.nome.split(' ')[0] : 'Usuário';
            document.getElementById('userName').textContent = primeiroNome;
            
            // Se tem altura, calcular IMC
            if (usuario.altura) {
                console.log('📏 Altura encontrada:', usuario.altura);
                await calcularIMC(usuario.altura);
            } else {
                console.log('⚠️ Usuário sem altura cadastrada');
                const imcContainer = document.getElementById('imcContainer');
                if (imcContainer) {
                    imcContainer.innerHTML = '<p class="info-message">⚠️ Cadastre sua altura na aba Pesagem para visualizar o IMC</p>';
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
    }
}

// Calcular IMC e métricas avançadas
async function calcularIMC(altura) {
    console.log('🧮 Iniciando cálculo IMC com altura:', altura);
    try {
        const response = await fetch(`${API_BASE}/meu-historico`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        console.log('📊 Resposta do /api/meu-historico:', response.status);
        
        if (!response.ok) {
            console.error('❌ Erro ao buscar pesagens:', response.status);
            return;
        }
        
        const pesagens = await response.json();
        console.log('📊 Pesagens recebidas:', pesagens);
        
        // Filtrar apenas pesagens não excluídas
        const pesagensAtivas = pesagens.filter(p => !p.excluido || p.excluido === 0);
        console.log('✅ Pesagens ativas (não excluídas):', pesagensAtivas);
        
        if (!pesagensAtivas || pesagensAtivas.length === 0) {
            console.log('⚠️ Nenhuma pesagem ativa encontrada');
            const imcContainer = document.getElementById('imcContainer');
            if (imcContainer) {
                imcContainer.innerHTML = '<p class="info-message">⚠️ Registre uma pesagem para calcular o IMC</p>';
            }
            return;
        }
        
        // Pegar última pesagem ativa (mais recente)
        const ultimaPesagem = pesagensAtivas[0];
        console.log('📊 Última pesagem ativa:', ultimaPesagem);
        const peso = parseFloat(ultimaPesagem.peso);
        console.log('⚖️ Peso usado para cálculo:', peso);
        const imc = (peso / (altura * altura)).toFixed(1);
        
        // Verificar se tem dados de bioimpedância
        const temBioimpedancia = ultimaPesagem.gordura_percentual !== null && 
                                 ultimaPesagem.gordura_percentual !== undefined;
        
        let classificacao, cor, corHex, descricao;
        if (imc < 18.5) {
            classificacao = 'Baixo Peso';
            cor = 'var(--secondary-light)';
            corHex = '#9C27B0';
            descricao = 'Você está abaixo do peso ideal';
        } else if (imc < 25) {
            classificacao = 'Normal';
            cor = 'var(--success-color)';
            corHex = '#8BC34A';
            descricao = 'Você está no peso ideal! Continue assim! 🎉';
        } else if (imc < 30) {
            classificacao = 'Sobrepeso';
            cor = 'var(--warning-color)';
            corHex = '#ff9800';
            descricao = 'Você está levemente acima do peso';
        } else if (imc < 35) {
            classificacao = 'Obesidade Grau I';
            cor = 'var(--danger-color)';
            corHex = '#f44336';
            descricao = 'Obesidade grau I';
        } else if (imc < 40) {
            classificacao = 'Obesidade Grau II';
            cor = 'var(--danger-color)';
            corHex = '#f44336';
            descricao = 'Obesidade grau II';
        } else {
            classificacao = 'Obesidade Grau III';
            cor = 'var(--secondary-color)';
            corHex = '#7B1FA2';
            descricao = 'Obesidade grau III';
        }
        
        // Calcular peso ideal e progresso
        const pesoIdeal = (25 * altura * altura).toFixed(1);
        const diferenca = (peso - pesoIdeal).toFixed(1);
        const faltaPerder = parseFloat(diferenca);
        const progresso = faltaPerder > 0 ? Math.max(5, Math.min(100, 100 - (faltaPerder * 3.5))) : 100;
        
        // Calcular métricas avançadas se houver bioimpedância
        let metricasAvancadas = null;
        if (temBioimpedancia) {
            metricasAvancadas = calcularMetricasAvancadas(ultimaPesagem, altura);
        }
        
        // Renderizar
        const container = document.getElementById('imcContainer');
        if (container) {
            container.innerHTML = renderizarAnaliseCompleta({
                imc, classificacao, cor, corHex, altura, peso, pesoIdeal, diferenca, progresso,
                temBioimpedancia, metricasAvancadas
            });
            
            // Adicionar event listeners para as abas se houver bioimpedância
            if (temBioimpedancia) {
                setupTabListeners();
            }
        }
    } catch (error) {
        console.error('❌ Erro ao calcular IMC:', error);
    }
}

// Calcular métricas avançadas de composição corporal
function calcularMetricasAvancadas(pesagem, altura) {
    const peso = parseFloat(pesagem.peso);
    const gorduraPerc = parseFloat(pesagem.gordura_percentual) || 0;
    const massaMuscularPerc = parseFloat(pesagem.massa_muscular_percentual) || 0;
    const aguaPerc = parseFloat(pesagem.agua_percentual) || 0;
    const gorduraVisceral = parseFloat(pesagem.gordura_visceral) || 0;
    
    // IMG - Índice de Massa Gorda
    const massaGordaKg = (peso * gorduraPerc) / 100;
    const img = (massaGordaKg / (altura * altura)).toFixed(1);
    
    // FFMI - Fat-Free Mass Index (Índice de Massa Livre de Gordura)
    const massaMagraKg = peso - massaGordaKg;
    const ffmi = (massaMagraKg / (altura * altura)).toFixed(1);
    
    // Classificação por % de gordura (estimativa para homens - ajustar conforme necessário)
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
    
    // Classificação FFMI
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
    
    // Classificação Gordura Visceral
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
        img, ffmi, massaGordaKg, massaMagraKg,
        gorduraPerc, massaMuscularPerc, aguaPerc, gorduraVisceral,
        classificacaoGordura, corGordura,
        classificacaoFFMI, corFFMI,
        classificacaoVisceral, corVisceral
    };
}

// Renderizar análise completa com abas
function renderizarAnaliseCompleta(dados) {
    const { imc, classificacao, cor, corHex, altura, peso, pesoIdeal, diferenca, progresso, temBioimpedancia, metricasAvancadas } = dados;
    
    if (!temBioimpedancia) {
        // Renderização tradicional (sem abas)
        return `
            <div class="imc-card">
                <div class="imc-header">
                    <div class="imc-value-circle" style="border-color: ${cor};">
                        <span class="imc-number">${imc}</span>
                        <span class="imc-label">IMC</span>
                    </div>
                    <div class="imc-classification">
                        <div class="classification-badge" style="background: ${cor}; color: white;">
                            ${classificacao}
                        </div>
                    </div>
                </div>
                
                <div class="imc-details-grid">
                    <div class="imc-detail-item">
                        <span class="imc-detail-icon">📏</span>
                        <div>
                            <span class="imc-detail-label">Altura:</span>
                            <span class="imc-detail-value">${altura.toFixed(2)} m</span>
                        </div>
                    </div>
                    <div class="imc-detail-item">
                        <span class="imc-detail-icon">⚖️</span>
                        <div>
                            <span class="imc-detail-label">Peso atual:</span>
                            <span class="imc-detail-value">${peso.toFixed(1)} kg</span>
                        </div>
                    </div>
                    <div class="imc-detail-item">
                        <span class="imc-detail-icon">🎯</span>
                        <div>
                            <span class="imc-detail-label">Peso ideal:</span>
                            <span class="imc-detail-value">${pesoIdeal} kg</span>
                        </div>
                    </div>
                    ${diferenca > 0 ? `
                    <div class="imc-detail-item highlight">
                        <span class="imc-detail-icon">📉</span>
                        <div>
                            <span class="imc-detail-label">Faltam:</span>
                            <span class="imc-detail-value">${diferenca} kg para IMC 25</span>
                        </div>
                    </div>
                    ` : `
                    <div class="imc-detail-item success">
                        <span class="imc-detail-icon">✅</span>
                        <div>
                            <span class="imc-detail-value">Você está no peso ideal!</span>
                        </div>
                    </div>
                    `}
                </div>
                
                ${diferenca > 0 ? `
                <div class="imc-progress-section">
                    <h4 class="progress-title">Progresso para IMC Saudável</h4>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${progresso}%; background: linear-gradient(90deg, ${corHex}, ${corHex}dd);">
                                <span class="progress-percentage">${progresso.toFixed(0)}%</span>
                            </div>
                        </div>
                        <p class="progress-info">Faltam ${diferenca} kg para atingir IMC 25</p>
                    </div>
                </div>
                ` : ''}
                
                <div class="info-box">
                    <span class="material-icons">info</span>
                    <p>Registre dados de bioimpedância para ver análise corporal avançada!</p>
                </div>
            </div>
        `;
    }
    
    // Renderização com abas (quando tem bioimpedância)
    const m = metricasAvancadas;
    return `
        <div class="analysis-tabs-container">
            <div class="analysis-tabs">
                <button class="tab-btn active" data-tab="imc">📊 IMC Tradicional</button>
                <button class="tab-btn" data-tab="avancado">🔬 Análise Avançada</button>
            </div>
            
            <div class="tab-content active" data-tab-content="imc">
                <div class="imc-card">
                    <div class="imc-header">
                        <div class="imc-value-circle" style="border-color: ${cor};">
                            <span class="imc-number">${imc}</span>
                            <span class="imc-label">IMC</span>
                        </div>
                        <div class="imc-classification">
                            <div class="classification-badge" style="background: ${cor}; color: white;">
                                ${classificacao}
                            </div>
                        </div>
                    </div>
                    
                    <div class="imc-details-grid">
                        <div class="imc-detail-item">
                            <span class="imc-detail-icon">📏</span>
                            <div>
                                <span class="imc-detail-label">Altura:</span>
                                <span class="imc-detail-value">${altura.toFixed(2)} m</span>
                            </div>
                        </div>
                        <div class="imc-detail-item">
                            <span class="imc-detail-icon">⚖️</span>
                            <div>
                                <span class="imc-detail-label">Peso atual:</span>
                                <span class="imc-detail-value">${peso.toFixed(1)} kg</span>
                            </div>
                        </div>
                        <div class="imc-detail-item">
                            <span class="imc-detail-icon">🎯</span>
                            <div>
                                <span class="imc-detail-label">Peso ideal:</span>
                                <span class="imc-detail-value">${pesoIdeal} kg</span>
                            </div>
                        </div>
                    </div>
                    
                    ${diferenca > 0 ? `
                    <div class="imc-progress-section">
                        <h4 class="progress-title">Progresso para IMC Saudável</h4>
                        <div class="progress-bar-wrapper">
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: ${progresso}%; background: linear-gradient(90deg, ${corHex}, ${corHex}dd);">
                                    <span class="progress-percentage">${progresso.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="tab-content" data-tab-content="avancado">
                <div class="advanced-metrics-grid">
                    <!-- IMG -->
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
                    
                    <!-- FFMI -->
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
                    
                    <!-- Composição Corporal -->
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
                    
                    <!-- Comparativo -->
                    <div class="metric-card full-width comparison-card">
                        <div class="metric-header">
                            <span class="metric-icon">⚖️</span>
                            <h3>Comparativo: IMC vs Análise Corporal</h3>
                        </div>
                        <div class="comparison-grid">
                            <div class="comparison-item">
                                <h4>IMC Tradicional</h4>
                                <p class="comparison-value" style="color: ${cor};">${imc}</p>
                                <p class="comparison-label">${classificacao}</p>
                                <p class="comparison-desc">Baseado apenas em peso e altura</p>
                            </div>
                            <div class="comparison-divider">
                                <span class="material-icons">compare_arrows</span>
                            </div>
                            <div class="comparison-item">
                                <h4>Análise Avançada</h4>
                                <p class="comparison-value" style="color: ${m.corGordura};">IMG ${m.img}</p>
                                <p class="comparison-label">${m.classificacaoGordura}</p>
                                <p class="comparison-desc">Baseado em composição corporal real</p>
                            </div>
                        </div>
                        <div class="comparison-insight">
                            <span class="material-icons">lightbulb</span>
                            <p><strong>Insight:</strong> A análise de bioimpedância fornece uma visão mais precisa da sua saúde, 
                            considerando gordura vs. músculo, não apenas o peso total.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Setup dos event listeners das abas
function setupTabListeners() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Remove active de todas as abas e conteúdos
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Adiciona active na aba clicada e no conteúdo correspondente
            tab.classList.add('active');
            document.querySelector(`[data-tab-content="${targetTab}"]`).classList.add('active');
        });
    });
}


// Salvar bioimpedância
async function salvarBioimpedancia(e) {
    e.preventDefault();
    
    const dadosBio = {
        peso: parseFloat(document.getElementById('bioPeso').value),
        gordura_percentual: document.getElementById('bioGordura').value ? parseFloat(document.getElementById('bioGordura').value) : null,
        massa_muscular_percentual: document.getElementById('bioMassaMuscular').value ? parseFloat(document.getElementById('bioMassaMuscular').value) : null,
        agua_percentual: document.getElementById('bioAgua').value ? parseFloat(document.getElementById('bioAgua').value) : null,
        massa_ossea: document.getElementById('bioMassaOssea').value ? parseFloat(document.getElementById('bioMassaOssea').value) : null,
        metabolismo_basal: document.getElementById('bioMetabolismoBasal').value ? parseFloat(document.getElementById('bioMetabolismoBasal').value) : null,
        idade_metabolica: document.getElementById('bioIdadeMetabolica').value ? parseInt(document.getElementById('bioIdadeMetabolica').value) : null,
        gordura_visceral: document.getElementById('bioGorduraVisceral').value ? parseFloat(document.getElementById('bioGorduraVisceral').value) : null
    };
    
    console.log('💾 Salvando bioimpedância:', dadosBio);
    
    // Data atual no formato YYYY-MM-DD
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];
    
    try {
        const response = await fetch(`${API_BASE}/pesagens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                data_pesagem: dataFormatada,
                peso: dadosBio.peso,
                gordura_percentual: dadosBio.gordura_percentual,
                massa_muscular_percentual: dadosBio.massa_muscular_percentual,
                agua_percentual: dadosBio.agua_percentual,
                massa_ossea: dadosBio.massa_ossea,
                metabolismo_basal: dadosBio.metabolismo_basal,
                idade_metabolica: dadosBio.idade_metabolica,
                gordura_visceral: dadosBio.gordura_visceral
            })
        });
        
        if (response.ok) {
            mostrarNotificacao('✅ Bioimpedância salva com sucesso!', 'success');
            limparFormulario();
            await carregarHistoricoBio();
            await carregarNomeUsuario(); // Atualizar IMC
        } else {
            const error = await response.json();
            mostrarNotificacao('❌ Erro ao salvar: ' + (error.error || 'Erro desconhecido'), 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar bioimpedância:', error);
        mostrarNotificacao('❌ Erro ao salvar bioimpedância. Tente novamente.', 'error');
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('formBioimpedancia').reset();
}

// Carregar histórico de bioimpedância
async function carregarHistoricoBio() {
    console.log('📊 Carregando histórico de bioimpedância...');
    try {
        const response = await fetch(`${API_BASE}/meu-historico`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('❌ Erro ao carregar histórico:', response.status);
            return;
        }
        
        const pesagens = await response.json();
        console.log('📊 Pesagens recebidas:', pesagens);
        
        // Filtrar apenas pesagens com dados de bioimpedância
        const bioimpedancias = pesagens.filter(p => 
            p.gordura_percentual || p.massa_muscular_percentual || 
            p.agua_percentual || p.massa_ossea || 
            p.metabolismo_basal || p.idade_metabolica || 
            p.gordura_visceral
        );
        
        const container = document.getElementById('historicoBioContainer');
        
        if (bioimpedancias.length === 0) {
            container.innerHTML = '<div class="empty-state">📊 Nenhum registro de bioimpedância ainda</div>';
            return;
        }
        
        let html = '<div class="bio-historico-grid">';
        
        bioimpedancias.forEach(bio => {
            const data = new Date(bio.data_pesagem).toLocaleDateString('pt-BR');
            html += `
                <div class="bio-historico-card">
                    <div class="bio-historico-header">
                        <span class="bio-historico-data">📅 ${data}</span>
                        <span class="bio-historico-peso">⚖️ ${bio.peso.toFixed(1)} kg</span>
                    </div>
                    <div class="bio-historico-details">
                        ${bio.gordura_percentual ? `<div class="bio-detail"><span>Gordura:</span> <strong>${bio.gordura_percentual}%</strong></div>` : ''}
                        ${bio.massa_muscular_percentual ? `<div class="bio-detail"><span>Massa Muscular:</span> <strong>${bio.massa_muscular_percentual}%</strong></div>` : ''}
                        ${bio.agua_percentual ? `<div class="bio-detail"><span>Água:</span> <strong>${bio.agua_percentual}%</strong></div>` : ''}
                        ${bio.massa_ossea ? `<div class="bio-detail"><span>Massa Óssea:</span> <strong>${bio.massa_ossea} kg</strong></div>` : ''}
                        ${bio.metabolismo_basal ? `<div class="bio-detail"><span>Metabolismo Basal:</span> <strong>${bio.metabolismo_basal} kcal</strong></div>` : ''}
                        ${bio.idade_metabolica ? `<div class="bio-detail"><span>Idade Metabólica:</span> <strong>${bio.idade_metabolica} anos</strong></div>` : ''}
                        ${bio.gordura_visceral ? `<div class="bio-detail"><span>Gordura Visceral:</span> <strong>Nível ${bio.gordura_visceral}</strong></div>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error);
    }
}

// Sistema de notificações toast
function mostrarNotificacao(mensagem, tipo = 'info', duracao = 4000) {
    // Criar container se não existir
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Criar toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    
    // Ícone baseado no tipo
    const icones = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icones[tipo]}</span>
        <span class="toast-message">${mensagem}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => toast.classList.add('toast-show'), 10);
    
    // Remover automaticamente
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, duracao);
}
