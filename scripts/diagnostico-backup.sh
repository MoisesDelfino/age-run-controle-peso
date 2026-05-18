#!/bin/bash
# Script de diagnóstico do sistema de backup

echo "🔍 DIAGNÓSTICO DO SISTEMA DE BACKUP"
echo "=================================="
echo ""

# 1. Verificar arquivos locais
echo "📁 1. BACKUPS LOCAIS:"
echo "-------------------"
if [ -d "backups" ]; then
    echo "✅ Diretório backups/ existe"
    backup_count=$(ls -1 backups/*.json 2>/dev/null | wc -l)
    echo "📊 Total de backups: $backup_count arquivo(s)"
    echo ""
    echo "Arquivos:"
    ls -lht backups/*.json 2>/dev/null | head -5
else
    echo "❌ Diretório backups/ NÃO encontrado"
fi

echo ""
echo ""

# 2. Verificar commits de backup
echo "📝 2. COMMITS DE BACKUP (últimos 7 dias):"
echo "-----------------------------------------"
backup_commits=$(git log --oneline --grep="Backup\|backup" --since="7 days ago" 2>/dev/null | wc -l)
if [ $backup_commits -gt 0 ]; then
    echo "✅ $backup_commits commit(s) de backup encontrado(s)"
    git log --oneline --grep="Backup\|backup" --since="7 days ago" | head -5
else
    echo "⚠️  Nenhum commit de backup nos últimos 7 dias"
fi

echo ""
echo ""

# 3. Verificar GitHub Actions workflow
echo "🤖 3. GITHUB ACTIONS:"
echo "--------------------"
if [ -f ".github/workflows/backup.yml" ]; then
    echo "✅ Workflow backup.yml existe"
    echo ""
    echo "Configuração:"
    echo "  - Agendamento: $(grep -A 1 "schedule:" .github/workflows/backup.yml | tail -1 | xargs)"
    echo "  - Execução manual: $(grep "workflow_dispatch" .github/workflows/backup.yml &>/dev/null && echo "✅ Habilitada" || echo "❌ Desabilitada")"
else
    echo "❌ Arquivo .github/workflows/backup.yml NÃO encontrado"
fi

echo ""
echo ""

# 4. Verificar DATABASE_URL local
echo "🗄️  4. CONFIGURAÇÃO LOCAL:"
echo "-------------------------"
if [ -f ".env" ]; then
    if grep -q "DATABASE_URL=" .env && ! grep -q "DATABASE_URL=$" .env; then
        echo "✅ DATABASE_URL configurada no .env"
        # Não mostrar a URL completa por segurança
        echo "   $(grep DATABASE_URL .env | cut -d'/' -f1-3)/.../$(grep DATABASE_URL .env | rev | cut -d'/' -f1 | rev)"
    else
        echo "⚠️  DATABASE_URL vazia ou não configurada no .env"
    fi
else
    echo "⚠️  Arquivo .env não encontrado"
fi

echo ""
echo ""

# 5. Status do repositório
echo "📦 5. STATUS DO REPOSITÓRIO:"
echo "---------------------------"
git_status=$(git status --porcelain 2>/dev/null)
if [ -z "$git_status" ]; then
    echo "✅ Working directory limpo"
else
    echo "⚠️  Há mudanças não commitadas:"
    git status --short
fi

echo ""
current_branch=$(git branch --show-current 2>/dev/null)
echo "Branch atual: $current_branch"

echo ""
last_sync=$(git log -1 --format="%cd" --date=relative origin/$current_branch 2>/dev/null)
echo "Último sync remoto: $last_sync"

echo ""
echo ""

# 6. Verificar último backup
echo "⏰ 6. ÚLTIMO BACKUP:"
echo "-------------------"
if [ -f "backups/backup-latest.json" ]; then
    echo "✅ backup-latest.json existe"
    
    # Extrair data do backup usando Python se disponível
    if command -v python3 &>/dev/null; then
        backup_date=$(python3 -c "import json; print(json.load(open('backups/backup-latest.json'))['date'])" 2>/dev/null)
        if [ ! -z "$backup_date" ]; then
            echo "📅 Data: $backup_date"
        fi
        
        # Estatísticas
        stats=$(python3 -c "import json; s=json.load(open('backups/backup-latest.json'))['stats']; print(f\"Usuários: {s['total_usuarios']}, Pesagens: {s['total_pesagens']}\")" 2>/dev/null)
        if [ ! -z "$stats" ]; then
            echo "📊 $stats"
        fi
    fi
    
    # Tamanho
    size=$(ls -lh backups/backup-latest.json | awk '{print $5}')
    echo "💾 Tamanho: $size"
else
    echo "❌ backup-latest.json NÃO encontrado"
fi

echo ""
echo ""

# 7. Recomendações
echo "💡 7. DIAGNÓSTICO E RECOMENDAÇÕES:"
echo "---------------------------------"

problems=0

# Verificar se há backups recentes (menos de 2 dias)
if [ -f "backups/backup-latest.json" ]; then
    file_age=$(($(date +%s) - $(stat -c %Y backups/backup-latest.json 2>/dev/null || stat -f %m backups/backup-latest.json 2>/dev/null)))
    days_old=$((file_age / 86400))
    
    if [ $days_old -gt 2 ]; then
        echo "⚠️  Último backup tem $days_old dia(s)"
        echo "   → O backup automático pode não estar funcionando"
        problems=$((problems + 1))
    else
        echo "✅ Backup recente (menos de 2 dias)"
    fi
else
    echo "❌ Nenhum backup encontrado"
    problems=$((problems + 1))
fi

# Verificar DATABASE_URL
if ! grep -q "DATABASE_URL=" .env 2>/dev/null || grep -q "DATABASE_URL=$" .env 2>/dev/null; then
    echo "⚠️  DATABASE_URL não configurada localmente"
    echo "   → Configure no arquivo .env para testes locais"
    problems=$((problems + 1))
fi

echo ""

if [ $problems -eq 0 ]; then
    echo "🎉 TUDO OK! Sistema de backup funcionando corretamente."
else
    echo "⚠️  $problems problema(s) detectado(s)."
    echo ""
    echo "PRÓXIMOS PASSOS:"
    echo "1. Verifique se DATABASE_URL está configurada no GitHub:"
    echo "   https://github.com/MoisesDelfino/age-run-controle-peso/settings/secrets/actions"
    echo ""
    echo "2. Teste o backup manualmente:"
    echo "   npm run backup"
    echo ""
    echo "3. Teste o GitHub Actions:"
    echo "   https://github.com/MoisesDelfino/age-run-controle-peso/actions"
    echo "   Clique em 'Run workflow'"
fi

echo ""
echo "=================================="
echo "Diagnóstico concluído em $(date)"
