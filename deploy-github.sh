#!/bin/bash
# 🚀 Script de Deploy Automatizado

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  🏃‍♂️ AGE RUN - Deploy Automatizado                ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Verificar se GitHub username foi fornecido
if [ -z "$1" ]; then
    echo "❌ Erro: Forneça seu usuário do GitHub"
    echo ""
    echo "Uso: ./deploy-github.sh SEU-USUARIO-GITHUB"
    echo ""
    echo "Exemplo: ./deploy-github.sh moises-delfino"
    exit 1
fi

GITHUB_USER=$1
REPO_NAME="age-run-controle-peso"

echo "🔍 Verificando configuração..."
echo "   GitHub User: $GITHUB_USER"
echo "   Repositório: $REPO_NAME"
echo ""

# Verificar se já tem remote
if git remote | grep -q origin; then
    echo "⚠️  Remote 'origin' já existe"
    echo "   Removendo remote antigo..."
    git remote remove origin
fi

# Adicionar remote
echo "📡 Adicionando remote do GitHub..."
git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git

# Verificar branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔀 Renomeando branch para 'main'..."
    git branch -M main
fi

# Push
echo "📤 Enviando código para GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════╗"
    echo "║  ✅ CÓDIGO ENVIADO COM SUCESSO!                    ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo "🌐 Repositório: https://github.com/$GITHUB_USER/$REPO_NAME"
    echo ""
    echo "📋 PRÓXIMO PASSO:"
    echo "   1. Acesse: https://render.com/"
    echo "   2. Faça login com GitHub"
    echo "   3. Clique em 'New +' → 'Web Service'"
    echo "   4. Conecte o repositório: $REPO_NAME"
    echo "   5. Configure e aguarde o deploy!"
    echo ""
    echo "🎉 Em 5 minutos seu site estará no ar!"
    echo ""
else
    echo ""
    echo "❌ Erro ao enviar código"
    echo ""
    echo "Possíveis causas:"
    echo "   1. Repositório não existe no GitHub"
    echo "   2. Nome de usuário incorreto"
    echo "   3. Sem permissão de acesso"
    echo ""
    echo "Soluções:"
    echo "   1. Crie o repositório em: https://github.com/new"
    echo "   2. Verifique seu nome de usuário"
    echo "   3. Configure autenticação: git config --global user.name"
    echo ""
fi
