// bioimpedancia-scanner.js
// Processamento de imagens e PDFs de bioimpedância com OCR

class BioimpedanciaScanner {
    constructor() {
        this.worker = null;
        this.initTesseract();
    }

    async initTesseract() {
        // Importar Tesseract.js do CDN (será adicionado no HTML)
        if (typeof Tesseract === 'undefined') {
            console.error('Tesseract.js não carregado');
            return;
        }

        this.worker = await Tesseract.createWorker('por+eng', 1, {
            logger: m => console.log(m)
        });
    }

    /**
     * Processa imagem e extrai dados de bioimpedância
     */
    async processarImagem(imageData) {
        if (!this.worker) {
            await this.initTesseract();
        }

        try {
            // Realizar OCR
            const { data: { text } } = await this.worker.recognize(imageData);
            console.log('Texto extraído:', text);

            // Extrair dados estruturados
            const dados = this.extrairDados(text);
            return dados;

        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            throw new Error('Erro ao processar imagem. Tente novamente com uma foto mais nítida.');
        }
    }

    /**
     * Processa PDF convertendo para imagem primeiro
     */
    async processarPDF(pdfFile) {
        try {
            // Carregar PDF usando PDF.js (será carregado do CDN)
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            // Pegar primeira página
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });

            // Criar canvas para renderizar
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Converter canvas para imagem
            const imageData = canvas.toDataURL('image/png');
            
            // Processar imagem
            return await this.processarImagem(imageData);

        } catch (error) {
            console.error('Erro ao processar PDF:', error);
            throw new Error('Erro ao processar PDF. Verifique se o arquivo está correto.');
        }
    }

    /**
     * Extrai dados estruturados do texto OCR
     */
    extrairDados(text) {
        const dados = {
            peso: null,
            gordura_percentual: null,
            massa_muscular_percentual: null,
            agua_percentual: null,
            massa_ossea: null,
            metabolismo_basal: null,
            idade_metabolica: null,
            gordura_visceral: null
        };

        // Normalizar texto - preservar mais caracteres para melhor match
        const textoLimpo = text.toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        console.log('📝 Texto normalizado:', textoLimpo.substring(0, 500) + '...');

        // Padrões de extração melhorados (regex mais flexíveis)
        const padroes = {
            // Peso: buscar números de 2-3 dígitos seguidos de ponto/vírgula e decimal, próximos de palavras-chave
            peso: /(?:peso|weight|body\s*weight|wt|corporal|mass)[:\s-]*([0-9]{2,3}[.,][0-9]{1,2})\s*(?:kg|k)?/i,
            
            // Gordura: % de gordura
            gordura: /(?:gordura|body\s*fat|bf|fat|lipid)[:\s-]*([0-9]{1,2}[.,][0-9]{1,2})\s*%/i,
            
            // Massa muscular: buscar muscle ou muscular seguido de número
            massa_muscular: /(?:massa\s*muscular|muscle\s*mass|muscle|mm|skeletal)[:\s-]*([0-9]{1,2}[.,][0-9]{1,2})\s*%/i,
            
            // Água: % água corporal
            agua: /(?:[aá]gua|water|body\s*water|tbw|hidrata)[:\s-]*([0-9]{1,2}[.,][0-9]{1,2})\s*%/i,
            
            // Massa óssea: buscar bone ou óssea
            massa_ossea: /(?:massa\s*[óo]ssea|bone\s*mass|bone|[óo]ssea)[:\s-]*([0-9]{1}[.,][0-9]{1,2})\s*(?:kg|k)?/i,
            
            // Metabolismo basal: números de 3-4 dígitos próximos de TMB/BMR
            metabolismo: /(?:tmb|bmr|metabolismo|basal|kcal|cal)[:\s-]*([0-9]{3,4})/i,
            
            // Idade metabólica: 2 dígitos próximos de idade
            idade_metabolica: /(?:idade\s*metab|metabolic\s*age|age|years)[:\s-]*([0-9]{2})\s*(?:anos|years)?/i,
            
            // Gordura visceral: nível de 1-2 dígitos
            gordura_visceral: /(?:gordura\s*visceral|visceral\s*fat|visceral|vf)[:\s-]*([0-9]{1,2})/i
        };

        // Extrair cada dado
        for (const [campo, regex] of Object.entries(padroes)) {
            const match = textoLimpo.match(regex);
            if (match && match[1]) {
                let valor = parseFloat(match[1].replace(',', '.'));
                
                console.log(`🔍 Campo ${campo}: encontrado valor ${valor}`);
                
                // Validações mais permissivas
                if (campo === 'peso' && (valor < 30 || valor > 300)) {
                    console.log(`⚠️ Peso ${valor} fora do range válido`);
                    continue;
                }
                if (campo === 'gordura' && (valor < 3 || valor > 60)) {
                    console.log(`⚠️ Gordura ${valor}% fora do range válido`);
                    continue;
                }
                if (campo === 'massa_muscular' && (valor < 15 || valor > 75)) {
                    console.log(`⚠️ Massa muscular ${valor}% fora do range válido`);
                    continue;
                }
                if (campo === 'agua' && (valor < 30 || valor > 80)) {
                    console.log(`⚠️ Água ${valor}% fora do range válido`);
                    continue;
                }
                if (campo === 'massa_ossea' && (valor < 0.5 || valor > 10)) {
                    console.log(`⚠️ Massa óssea ${valor}kg fora do range válido`);
                    continue;
                }
                if (campo === 'metabolismo' && (valor < 800 || valor > 4000)) {
                    console.log(`⚠️ Metabolismo ${valor}kcal fora do range válido`);
                    continue;
                }
                if (campo === 'idade_metabolica' && (valor < 10 || valor > 90)) {
                    console.log(`⚠️ Idade metabólica ${valor} fora do range válido`);
                    continue;
                }
                if (campo === 'gordura_visceral' && (valor < 1 || valor > 30)) {
                    console.log(`⚠️ Gordura visceral ${valor} fora do range válido`);
                    continue;
                }

                const campoNome = campo === 'gordura' ? 'gordura_percentual' :
                                 campo === 'massa_muscular' ? 'massa_muscular_percentual' :
                                 campo === 'agua' ? 'agua_percentual' :
                                 campo === 'metabolismo' ? 'metabolismo_basal' : campo;

                dados[campoNome] = valor;
                console.log(`✅ ${campoNome} = ${valor}`);
            } else {
                console.log(`❌ Campo ${campo}: não encontrado`);
            }
        }

        // Calcular confiança (quantos campos foram preenchidos)
        const camposPreenchidos = Object.values(dados).filter(v => v !== null).length;
        dados.confianca = Math.round((camposPreenchidos / 8) * 100);

        console.log('📊 Dados extraídos:', dados);
        console.log(`📈 Confiança: ${dados.confianca}% (${camposPreenchidos}/8 campos)`);
        return dados;
    }

    /**
     * Pré-processar imagem para melhorar OCR
     */
    preProcessarImagem(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Aumentar contraste e converter para escala de cinza
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const valor = avg > 128 ? 255 : 0; // Binarização
            data[i] = valor;     // R
            data[i + 1] = valor; // G
            data[i + 2] = valor; // B
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
        }
    }
}

// Exportar para uso global
window.BioimpedanciaScanner = BioimpedanciaScanner;
