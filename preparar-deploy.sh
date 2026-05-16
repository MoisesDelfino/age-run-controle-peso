#!/bin/bash

echo "🚀 Iniciando preparação para deploy..."
echo ""

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script no diretório do projeto"
    exit 1
fi

echo "✅ Diretório correto"

# Verificar se git está instalado
if ! command -v git &> /dev/null; then
    echo "❌ Git não está instalado. Instale com: sudo apt install git"
    exit 1
fi

echo "✅ Git instalado"

# Verificar se já é um repositório git
if [ ! -d ".git" ]; then
    echo "📦 Inicializando repositório Git..."
    git init
    git add .
    git commit -m "Initial commit - Age Run Sistema Controle Peso"
    echo "✅ Repositório Git criado"
else
    echo "✅ Repositório Git já existe"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  📋 PRÓXIMOS PASSOS:"
echo "════════════════════════════════════════════════════"
echo ""
echo "1️⃣  Criar repositório no GitHub:"
echo "    https://github.com/new"
echo ""
echo "2️⃣  Enviar código para GitHub:"
echo "    git remote add origin https://github.com/SEU-USUARIO/age-run-controle-peso.git"
echo "    git branch -M main"
echo "    git push -u origin main"
echo ""
echo "3️⃣  Criar conta no Render:"
echo "    https://render.com/"
echo ""
echo "4️⃣  Criar Web Service no Render:"
echo "    - New + → Web Service"
echo "    - Conectar repositório do GitHub"
echo "    - Configurar conforme DEPLOY-GUIA.md"
echo ""
echo "5️⃣  Aguardar deploy e acessar seu site!"
echo ""
echo "════════════════════════════════════════════════════"
echo ""
echo "📖 Leia o guia completo em: DEPLOY-GUIA.md"
echo ""
echo "✅ Preparação concluída!"
