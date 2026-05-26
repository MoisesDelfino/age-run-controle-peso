// Configuração da API
var API_BASE = API_BASE || (window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : (window.location.pathname.startsWith('/controle') ? '/controle/api' : '/api'));

// Variáveis globais
let scanner;
let streamCamera;
let dadosBioimpedancia = null;
let cropState = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar scanner
    scanner = new BioimpedanciaScanner();
    await scanner.initTesseract();
    
    // Carregar nome do usuário
    await carregarNomeUsuario();
    
    // Carregar histórico de bioimpedância
    await carregarHistoricoBio();
    
    // Event listeners
    setupEventListeners();
    
    // Atualizar IMC quando a página recebe foco (usuário voltou da aba de pesagem)
    window.addEventListener('focus', async () => {
        console.log('🔄 Página recebeu foco, recarregando dados...');
        await carregarNomeUsuario();
    });
    
    // Detectar quando altura é atualizada em outra aba
    window.addEventListener('storage', async (e) => {
        if (e.key === 'altura_atualizada') {
            console.log('🔄 Altura atualizada em outra aba, recarregando IMC...');
            await carregarNomeUsuario();
        }
    });
});

// Carregar nome do usuário
async function carregarNomeUsuario() {
    console.log('🔍 Carregando dados do usuário...');
    try {
        const response = await fetch(`${API_BASE}/auth/session`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        console.log('📊 Resposta do /api/auth/session:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📦 Dados recebidos:', data);
            
            if (data.authenticated && data.usuario) {
                const usuario = data.usuario;
                console.log('👤 Usuário:', usuario);
                
                // Extrair apenas o primeiro nome
                const primeiroNome = usuario.nome.split(' ')[0];
                document.getElementById('userName').textContent = primeiroNome;
                
                // Se usuário tem altura, calcular IMC
                if (usuario.altura) {
                    console.log('📏 Altura encontrada:', usuario.altura, '- Calculando IMC...');
                    await calcularIMC(usuario.altura);
                } else {
                    console.log('⚠️ Altura não informada');
                    // Mostrar mensagem para informar altura
                    const imcContainer = document.getElementById('imcContainer');
                    console.log('📍 IMC Container encontrado:', imcContainer);
                    if (imcContainer) {
                        imcContainer.innerHTML = '<p class="info-message">⚠️ Informe sua altura na aba <a href="/pesagem" style="color: var(--primary-color); font-weight: bold;">Pesagem</a> para calcular o IMC</p>';
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Calcular IMC
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
        
        let classificacao, cor, descricao;
        if (imc < 18.5) {
            classificacao = 'Baixo Peso';
            cor = '#3498db';
            descricao = 'Você está abaixo do peso ideal';
        } else if (imc < 25) {
            classificacao = 'Normal';
            cor = '#2ecc71';
            descricao = 'Você está no peso ideal! Continue assim! 🎉';
        } else if (imc < 30) {
            classificacao = 'Sobrepeso';
            cor = '#f39c12';
            descricao = 'Você está levemente acima do peso';
        } else if (imc < 35) {
            classificacao = 'Obesidade Grau I';
            cor = '#e67e22';
            descricao = 'Atenção: obesidade grau I';
        } else if (imc < 40) {
            classificacao = 'Obesidade Grau II';
            cor = '#e74c3c';
            descricao = 'Atenção: obesidade grau II';
        } else {
            classificacao = 'Obesidade Grau III';
            cor = '#c0392b';
            descricao = 'Atenção: obesidade grau III';
        }
        
        // Calcular peso ideal e progresso
        const pesoIdeal = (25 * altura * altura).toFixed(1);
        const diferenca = (peso - pesoIdeal).toFixed(1);
        // Progresso: quanto mais próximo do peso ideal, maior a barra
        const pesoInicial = peso; // Se tiver peso inicial, usar aqui
        const faltaPerder = parseFloat(diferenca);
        // Se está acima do peso, calcular progresso baseado em perder 1kg = ~3.5% de progresso
        const progresso = faltaPerder > 0 ? Math.max(5, Math.min(100, 100 - (faltaPerder * 3.5))) : 100;
        
        // Renderizar
        const container = document.getElementById('imcContainer');
        console.log('📍 IMC Container para renderizar:', container);
        if (container) {
            console.log('✅ Renderizando IMC no container...');
            container.innerHTML = `
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
                                <div class="progress-bar-fill" style="width: ${progresso}%; background: linear-gradient(90deg, ${cor}, ${cor}dd);">
                                    <span class="progress-percentage">${progresso.toFixed(0)}%</span>
                                </div>
                            </div>
                            <p class="progress-info">Faltam ${diferenca} kg para atingir IMC 25</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            console.log('✅ IMC renderizado com sucesso!');
        } else {
            console.error('❌ IMC Container não encontrado!');
        }
    } catch (error) {
        console.error('Erro ao calcular IMC:', error);
    }
}

// Configurar event listeners
function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Botão principal de importar
    const btnImportar = document.getElementById('btnImportarBioimpedancia');
    console.log('🔍 Botão importar encontrado:', btnImportar);
    
    if (btnImportar) {
        btnImportar.addEventListener('click', () => {
            console.log('🖱️ Botão IMPORTAR BIOIMPEDÂNCIA clicado!');
            const menu = document.getElementById('menuOpcoes');
            console.log('📋 Menu encontrado:', menu);
            console.log('📋 Display atual do menu:', menu.style.display);
            menu.style.display = menu.style.display === 'none' || menu.style.display === '' ? 'block' : 'none';
            console.log('📋 Novo display do menu:', menu.style.display);
        });
    } else {
        console.error('❌ ERRO: Botão btnImportarBioimpedancia não encontrado!');
    }
    
    // Opção câmera
    document.getElementById('btnCapturarBio').addEventListener('click', abrirCamera);
    
    // Opção arquivo
    document.getElementById('btnImportarArquivo').addEventListener('click', () => {
        document.getElementById('inputArquivo').click();
    });
    
    // Input de arquivo
    document.getElementById('inputArquivo').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;
        
        console.log(`📁 ${files.length} arquivo(s) selecionado(s)`);
        
        // Fechar menu
        document.getElementById('menuOpcoes').style.display = 'none';
        
        // Processar PDFs automaticamente em sequência
        const pdfs = files.filter(f => f.type === 'application/pdf');
        const images = files.filter(f => f.type.startsWith('image/'));
        
        // Processar PDFs primeiro (automático)
        for (let i = 0; i < pdfs.length; i++) {
            const file = pdfs[i];
            console.log(`🔄 Processando PDF ${i + 1}/${pdfs.length}: ${file.name}`);
            await processarPDF(file);
            if (i < pdfs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Processar primeira imagem (manual - usuário precisa fazer crop)
        if (images.length > 0) {
            console.log(`📷 ${images.length} imagem(ns) selecionada(s). Processando primeira...`);
            const reader = new FileReader();
            reader.onload = (event) => {
                // Delay para garantir renderização correta do modal
                setTimeout(() => {
                    mostrarModalCrop(event.target.result);
                    
                    // Mostrar notificação se houver mais de uma imagem
                    if (images.length > 1) {
                        setTimeout(() => {
                            let mensagem = '';
                            if (pdfs.length > 0) {
                                mensagem = `✅ ${pdfs.length} PDF(s) processado(s). `;
                            }
                            mensagem += `⚠️ Você selecionou ${images.length} imagens. Processe uma por vez.`;
                            mostrarNotificacao(mensagem, 'warning', 5000);
                        }, 500);
                    }
                }, 100);
            };
            reader.readAsDataURL(images[0]);
        } else if (pdfs.length > 0) {
            mostrarNotificacao(`✅ ${pdfs.length} PDF(s) processado(s) com sucesso!`, 'success');
        }
        
        // Limpar input para permitir selecionar os mesmos arquivos novamente
        e.target.value = '';
    });
    
    // Câmera
    document.getElementById('btnFecharCamera').addEventListener('click', fecharCamera);
    document.getElementById('btnCapturarFoto').addEventListener('click', capturarFoto);
    
    // Crop
    document.getElementById('btnFecharCrop').addEventListener('click', fecharModalCrop);
    document.getElementById('btnCancelarCrop').addEventListener('click', fecharModalCrop);
    document.getElementById('btnProcessarCrop').addEventListener('click', processarCrop);
    
    // Editar dados
    document.getElementById('btnEditarDados').addEventListener('click', abrirModalEditar);
    document.getElementById('btnFecharEditar').addEventListener('click', fecharModalEditar);
    document.getElementById('btnCancelarEdicao').addEventListener('click', fecharModalEditar);
    document.getElementById('formEditarDados').addEventListener('submit', salvarEdicao);
    
    // Salvar bioimpedância
    document.getElementById('btnSalvarBioimpedancia').addEventListener('click', salvarBioimpedancia);
}

// Carregar dados do usuário
async function carregarDadosUsuario() {
    try {
        const response = await fetch(`${API_BASE}/usuario`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (response.ok) {
            const usuario = await response.json();
            document.getElementById('userName').textContent = usuario.nome;
            
            // Preencher altura se existir
            if (usuario.altura) {
                document.getElementById('altura').value = usuario.altura;
                await calcularIMC(usuario.altura);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Salvar altura
async function salvarAltura(e) {
    e.preventDefault();
    
    const altura = parseFloat(document.getElementById('altura').value);
    const messageDiv = document.getElementById('messageAltura');
    
    console.log('Salvando altura:', altura);
    
    if (!altura || altura < 0.5 || altura > 2.5) {
        messageDiv.textContent = 'Por favor, insira uma altura válida entre 0.5 e 2.5 metros.';
        messageDiv.className = 'message error';
        return;
    }
    
    try {
        console.log('Fazendo requisição para:', `${API_BASE}/usuarios/altura`);
        const response = await fetch(`${API_BASE}/usuarios/altura`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ altura })
        });
        
        console.log('Resposta recebida:', response.status, response.ok);
        
        if (response.ok) {
            messageDiv.textContent = 'Altura salva com sucesso!';
            messageDiv.className = 'message success';
            
            // Calcular IMC
            await calcularIMC(altura);
            
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = 'message';
            }, 3000);
        } else {
            const errorData = await response.json();
            console.error('Erro na resposta:', errorData);
            throw new Error('Erro ao salvar altura');
        }
    } catch (error) {
        console.error('Erro ao salvar altura:', error);
        messageDiv.textContent = 'Erro ao salvar altura. Tente novamente.';
        messageDiv.className = 'message error';
    }
}

// Abrir câmera
async function abrirCamera() {
    try {
        // Fechar menu
        document.getElementById('menuOpcoes').style.display = 'none';
        
        streamCamera = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        const video = document.getElementById('videoCamera');
        video.srcObject = streamCamera;
        
        document.getElementById('modalCamera').style.display = 'flex';
    } catch (error) {
        console.error('Erro ao acessar câmera:', error);
        alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
}

// Fechar câmera
function fecharCamera() {
    if (streamCamera) {
        streamCamera.getTracks().forEach(track => track.stop());
        streamCamera = null;
    }
    document.getElementById('modalCamera').style.display = 'none';
}

// Capturar foto
async function capturarFoto() {
    const video = document.getElementById('videoCamera');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    fecharCamera();
    
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    await processarBioimpedancia(imageData);
}

// Mostrar modal de crop
function mostrarModalCrop(imageData) {
    const canvas = document.getElementById('canvasCrop');
    const img = new Image();
    
    img.onload = () => {
        // Ajustar canvas
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Configurar área de crop inicial (60% do centro)
        const cropArea = document.getElementById('cropArea');
        const width = canvas.width * 0.6;
        const height = canvas.height * 0.6;
        const left = (canvas.width - width) / 2;
        const top = (canvas.height - height) / 2;
        
        cropArea.style.width = width + 'px';
        cropArea.style.height = height + 'px';
        cropArea.style.left = left + 'px';
        cropArea.style.top = top + 'px';
        
        cropState = { img, scale };
        
        // Configurar drag e resize
        setupCropInteraction();
        
        document.getElementById('modalCrop').style.display = 'flex';
    };
    
    img.src = imageData;
}

// Configurar interação do crop
function setupCropInteraction() {
    const cropArea = document.getElementById('cropArea');
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    let resizeHandle = null;
    
    // Drag
    cropArea.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('crop-handle')) {
            isResizing = true;
            resizeHandle = e.target;
        } else {
            isDragging = true;
        }
        startX = e.clientX;
        startY = e.clientY;
        startLeft = cropArea.offsetLeft;
        startTop = cropArea.offsetTop;
        startWidth = cropArea.offsetWidth;
        startHeight = cropArea.offsetHeight;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            cropArea.style.left = (startLeft + dx) + 'px';
            cropArea.style.top = (startTop + dy) + 'px';
        } else if (isResizing && resizeHandle) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            if (resizeHandle.classList.contains('handle-br')) {
                cropArea.style.width = (startWidth + dx) + 'px';
                cropArea.style.height = (startHeight + dy) + 'px';
            } else if (resizeHandle.classList.contains('handle-bl')) {
                cropArea.style.left = (startLeft + dx) + 'px';
                cropArea.style.width = (startWidth - dx) + 'px';
                cropArea.style.height = (startHeight + dy) + 'px';
            } else if (resizeHandle.classList.contains('handle-tr')) {
                cropArea.style.top = (startTop + dy) + 'px';
                cropArea.style.width = (startWidth + dx) + 'px';
                cropArea.style.height = (startHeight - dy) + 'px';
            } else if (resizeHandle.classList.contains('handle-tl')) {
                cropArea.style.left = (startLeft + dx) + 'px';
                cropArea.style.top = (startTop + dy) + 'px';
                cropArea.style.width = (startWidth - dx) + 'px';
                cropArea.style.height = (startHeight - dy) + 'px';
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        resizeHandle = null;
    });
}

// Processar crop
async function processarCrop() {
    const canvas = document.getElementById('canvasCrop');
    const cropArea = document.getElementById('cropArea');
    
    const scale = cropState.scale;
    const x = cropArea.offsetLeft / scale;
    const y = cropArea.offsetTop / scale;
    const width = cropArea.offsetWidth / scale;
    const height = cropArea.offsetHeight / scale;
    
    // Criar canvas com área recortada
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    
    const ctx = croppedCanvas.getContext('2d');
    ctx.drawImage(cropState.img, x, y, width, height, 0, 0, width, height);
    
    fecharModalCrop();
    
    const imageData = croppedCanvas.toDataURL('image/jpeg', 0.95);
    await processarBioimpedancia(imageData);
}

// Fechar modal crop
function fecharModalCrop() {
    document.getElementById('modalCrop').style.display = 'none';
    cropState = null;
}

// Processar PDF
async function processarPDF(pdfFile) {
    try {
        mostrarLoading();
        
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext('2d');
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        
        fecharLoading();
        await processarBioimpedancia(imageData);
    } catch (error) {
        console.error('❌ Erro ao processar PDF:', error);
        fecharLoading();
        mostrarNotificacao('❌ Erro ao processar PDF. Verifique se o arquivo está correto.', 'error');
    }
}

// Processar bioimpedância
async function processarBioimpedancia(imageData) {
    try {
        mostrarLoading();
        
        const dados = await scanner.processarImagem(imageData);
        
        fecharLoading();
        
        // Usar confianca (não confidence)
        const confianca = dados.confianca || 0;
        console.log('📊 Confiança da extração:', confianca + '%');
        
        if (dados && confianca > 15) {
            dadosBioimpedancia = dados;
            mostrarDadosExtraidos(dados);
            
            // Se confiança baixa, avisar mas permitir edição
            if (confianca < 40) {
                mostrarNotificacao('⚠️ Alguns dados podem estar incorretos. Revise antes de salvar.', 'warning');
            } else {
                mostrarNotificacao('✅ Dados extraídos com sucesso!', 'success');
            }
        } else {
            // Abrir modal de edição manual diretamente
            console.log('⚠️ Confiança muito baixa, abrindo edição manual...');
            dadosBioimpedancia = dados; // Salvar o que foi extraído
            mostrarDadosExtraidos(dados); // Mostrar mesmo com poucos dados
            mostrarNotificacao('❌ Não foi possível extrair dados suficientes. Use a edição manual abaixo.', 'error');
            
            // Abrir modal de edição automaticamente após 1 segundo
            setTimeout(() => {
                abrirModalEditar();
            }, 1500);
        }
    } catch (error) {
        console.error('❌ Erro ao processar bioimpedância:', error);
        fecharLoading();
        mostrarNotificacao('❌ Erro ao processar imagem. Tente novamente com melhor iluminação.', 'error');
    }
}

// Mostrar dados extraídos
function mostrarDadosExtraidos(dados) {
    const container = document.getElementById('dadosExtraidos');
    
    let html = '<div class="dados-grid">';
    
    const campos = [
        { key: 'peso', label: 'Peso', unidade: 'kg' },
        { key: 'gordura_percentual', label: 'Gordura', unidade: '%' },
        { key: 'massa_muscular_percentual', label: 'Massa Muscular', unidade: '%' },
        { key: 'agua_percentual', label: 'Água', unidade: '%' },
        { key: 'massa_ossea', label: 'Massa Óssea', unidade: 'kg' },
        { key: 'metabolismo_basal', label: 'Metabolismo Basal', unidade: 'kcal' },
        { key: 'idade_metabolica', label: 'Idade Metabólica', unidade: 'anos' },
        { key: 'gordura_visceral', label: 'Gordura Visceral', unidade: 'nível' }
    ];
    
    campos.forEach(campo => {
        const valor = dados[campo.key];
        if (valor !== null && valor !== undefined) {
            html += `
                <div class="dado-item">
                    <span class="dado-label">${campo.label}:</span>
                    <span class="dado-valor">${valor} ${campo.unidade}</span>
                </div>
            `;
        }
    });
    
    html += '</div>';
    html += `<p class="confidence-score">Confiança: ${(dados.confianca || 0).toFixed(0)}%</p>`;
    
    container.innerHTML = html;
    document.getElementById('bioimpedanciaPreview').style.display = 'block';
}

// Abrir modal de edição
function abrirModalEditar() {
    if (!dadosBioimpedancia) return;
    
    document.getElementById('editPeso').value = dadosBioimpedancia.peso || '';
    document.getElementById('editGordura').value = dadosBioimpedancia.gordura_percentual || '';
    document.getElementById('editMassaMuscular').value = dadosBioimpedancia.massa_muscular_percentual || '';
    document.getElementById('editAgua').value = dadosBioimpedancia.agua_percentual || '';
    document.getElementById('editMassaOssea').value = dadosBioimpedancia.massa_ossea || '';
    document.getElementById('editMetabolismoBasal').value = dadosBioimpedancia.metabolismo_basal || '';
    document.getElementById('editIdadeMetabolica').value = dadosBioimpedancia.idade_metabolica || '';
    document.getElementById('editGorduraVisceral').value = dadosBioimpedancia.gordura_visceral || '';
    
    document.getElementById('modalEditarDados').style.display = 'flex';
}

// Fechar modal de edição
function fecharModalEditar() {
    document.getElementById('modalEditarDados').style.display = 'none';
}

// Salvar edição
function salvarEdicao(e) {
    e.preventDefault();
    
    dadosBioimpedancia = {
        peso: parseFloat(document.getElementById('editPeso').value) || null,
        gordura_percentual: parseFloat(document.getElementById('editGordura').value) || null,
        massa_muscular_percentual: parseFloat(document.getElementById('editMassaMuscular').value) || null,
        agua_percentual: parseFloat(document.getElementById('editAgua').value) || null,
        massa_ossea: parseFloat(document.getElementById('editMassaOssea').value) || null,
        metabolismo_basal: parseInt(document.getElementById('editMetabolismoBasal').value) || null,
        idade_metabolica: parseInt(document.getElementById('editIdadeMetabolica').value) || null,
        gordura_visceral: parseInt(document.getElementById('editGorduraVisceral').value) || null,
        confidence: 100
    };
    
    mostrarDadosExtraidos(dadosBioimpedancia);
    fecharModalEditar();
}

// Salvar bioimpedância
async function salvarBioimpedancia() {
    if (!dadosBioimpedancia) return;
    
    // Redirecionar para página de pesagem com dados salvos
    sessionStorage.setItem('dadosBioimpedancia', JSON.stringify(dadosBioimpedancia));
    window.location.href = '/controle/pesagem';
}

// Carregar histórico de bioimpedância
async function carregarHistoricoBio() {
    try {
        const response = await fetch(`${API_BASE}/meu-historico`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (!response.ok) return;
        
        const pesagens = await response.json();
        const pesagensComBio = pesagens.filter(p => 
            p.gordura_percentual || p.massa_muscular_percentual
        );
        
        if (pesagensComBio.length === 0) return;
        
        const container = document.getElementById('historicoBioContainer');
        let html = '';
        
        pesagensComBio.reverse().forEach(p => {
            const data = new Date(p.data_pesagem).toLocaleDateString('pt-BR');
            html += `
                <div class="bio-card">
                    <div class="bio-header">
                        <span class="bio-date">📅 ${data}</span>
                        <span class="bio-peso">${p.peso} kg</span>
                    </div>
                    <div class="bio-dados-grid">
                        ${p.gordura_percentual ? `<div class="bio-item"><span>Gordura:</span><strong>${p.gordura_percentual}%</strong></div>` : ''}
                        ${p.massa_muscular_percentual ? `<div class="bio-item"><span>Músculo:</span><strong>${p.massa_muscular_percentual}%</strong></div>` : ''}
                        ${p.agua_percentual ? `<div class="bio-item"><span>Água:</span><strong>${p.agua_percentual}%</strong></div>` : ''}
                        ${p.massa_ossea ? `<div class="bio-item"><span>Massa Óssea:</span><strong>${p.massa_ossea} kg</strong></div>` : ''}
                        ${p.metabolismo_basal ? `<div class="bio-item"><span>TMB:</span><strong>${p.metabolismo_basal} kcal</strong></div>` : ''}
                        ${p.idade_metabolica ? `<div class="bio-item"><span>Idade Metab.:</span><strong>${p.idade_metabolica} anos</strong></div>` : ''}
                        ${p.gordura_visceral ? `<div class="bio-item"><span>Gordura Visc.:</span><strong>Nível ${p.gordura_visceral}</strong></div>` : ''}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// Loading modal
function mostrarLoading() {
    document.getElementById('modalLoading').style.display = 'flex';
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        document.getElementById('progressFill').style.width = progress + '%';
    }, 300);
    
    window.loadingInterval = interval;
}

function fecharLoading() {
    if (window.loadingInterval) {
        clearInterval(window.loadingInterval);
    }
    document.getElementById('progressFill').style.width = '100%';
    setTimeout(() => {
        document.getElementById('modalLoading').style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
    }, 500);
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
