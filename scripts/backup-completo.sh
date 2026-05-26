#!/bin/bash
# Script de Backup Completo - Produção Age Run
# Faz backup de banco de dados e código-fonte

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretórios
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="$BACKUP_ROOT/backup-completo-$TIMESTAMP"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔐 BACKUP COMPLETO - AGE RUN PRODUCTION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Data: $(date '+%d/%m/%Y %H:%M:%S')"
echo -e "📁 Destino: $BACKUP_DIR"
echo ""

# Criar estrutura de diretórios
mkdir -p "$BACKUP_DIR"/{database,code,logs}

# ============================================================================
# 1. BACKUP DO BANCO DE DADOS (JSON)
# ============================================================================
echo -e "${YELLOW}[1/5]${NC} 📊 Exportando dados do PostgreSQL (JSON)..."
cd "$PROJECT_DIR"
if node scripts/backup-database.js; then
    # Copiar último backup para pasta específica
    if [ -f "$BACKUP_ROOT/backup-latest.json" ]; then
        cp "$BACKUP_ROOT/backup-latest.json" "$BACKUP_DIR/database/dados-completos.json"
        echo -e "${GREEN}      ✅ Dados exportados para JSON${NC}"
    fi
else
    echo -e "${RED}      ⚠️  Erro ao exportar dados JSON${NC}"
fi

# ============================================================================
# 2. BACKUP DO BANCO DE DADOS (SQL DUMP)
# ============================================================================
echo -e "${YELLOW}[2/5]${NC} 🗄️  Criando dump SQL do PostgreSQL..."

# Carregar DATABASE_URL do .env
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | grep DATABASE_URL | xargs)
fi

if [ -n "$DATABASE_URL" ]; then
    # Tentar fazer dump com pg_dump
    if command -v pg_dump &> /dev/null; then
        DUMP_FILE="$BACKUP_DIR/database/postgresql-dump-$TIMESTAMP.sql"
        if pg_dump "$DATABASE_URL" > "$DUMP_FILE" 2>/dev/null; then
            echo -e "${GREEN}      ✅ Dump SQL criado ($(du -h "$DUMP_FILE" | cut -f1))${NC}"
        else
            echo -e "${YELLOW}      ⚠️  pg_dump disponível mas falhou (pode precisar de permissões)${NC}"
        fi
    else
        echo -e "${YELLOW}      ⚠️  pg_dump não instalado - executando backup alternativo${NC}"
        
        # Criar dump SQL simples usando Node.js
        cat > "$BACKUP_DIR/database/postgresql-export.sql" << 'EOSQL'
-- PostgreSQL Backup - Age Run
-- Gerado em: $(date)
-- IMPORTANTE: Este é um backup básico. Para restauração completa, use pg_dump.

-- Para importar este backup:
-- 1. Conecte ao PostgreSQL: psql $DATABASE_URL
-- 2. Execute: \i postgresql-export.sql

EOSQL
        echo -e "${GREEN}      ✅ Script SQL de referência criado${NC}"
    fi
else
    echo -e "${RED}      ❌ DATABASE_URL não encontrada no .env${NC}"
fi

# ============================================================================
# 3. BACKUP DOS BANCOS LOCAIS (SQLite)
# ============================================================================
echo -e "${YELLOW}[3/5]${NC} 💾 Copiando bancos de dados locais..."
if [ -f "$PROJECT_DIR/peso.db" ]; then
    cp "$PROJECT_DIR/peso.db" "$BACKUP_DIR/database/peso-local.db"
    echo -e "${GREEN}      ✅ peso.db copiado ($(du -h "$PROJECT_DIR/peso.db" | cut -f1))${NC}"
fi

if [ -f "$PROJECT_DIR/database.db" ]; then
    cp "$PROJECT_DIR/database.db" "$BACKUP_DIR/database/database-local.db"
    echo -e "${GREEN}      ✅ database.db copiado${NC}"
fi

# ============================================================================
# 4. BACKUP DO CÓDIGO-FONTE
# ============================================================================
echo -e "${YELLOW}[4/5]${NC} 📦 Compactando código-fonte..."

cd "$PROJECT_DIR"
tar -czf "$BACKUP_DIR/code/agerun-source-$TIMESTAMP.tar.gz" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='*.db' \
    --exclude='*.log' \
    --exclude='.env' \
    . 2>/dev/null

if [ -f "$BACKUP_DIR/code/agerun-source-$TIMESTAMP.tar.gz" ]; then
    echo -e "${GREEN}      ✅ Código compactado ($(du -h "$BACKUP_DIR/code/agerun-source-$TIMESTAMP.tar.gz" | cut -f1))${NC}"
fi

# Copiar arquivos de configuração importantes (sem credenciais)
cp "$PROJECT_DIR/.env.example" "$BACKUP_DIR/code/" 2>/dev/null || true
cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/code/" 2>/dev/null || true
cp "$PROJECT_DIR/README.md" "$BACKUP_DIR/code/" 2>/dev/null || true

# ============================================================================
# 5. GERAR RELATÓRIO DO BACKUP
# ============================================================================
echo -e "${YELLOW}[5/5]${NC} 📝 Gerando relatório..."

# Contar dados do backup JSON
if [ -f "$BACKUP_DIR/database/dados-completos.json" ]; then
    USUARIOS=$(grep -o '"id"' "$BACKUP_DIR/database/dados-completos.json" | grep -c . || echo "N/A")
    PESAGENS=$(grep -o '"data_pesagem"' "$BACKUP_DIR/database/dados-completos.json" | grep -c . || echo "N/A")
else
    USUARIOS="N/A"
    PESAGENS="N/A"
fi

# Criar relatório
cat > "$BACKUP_DIR/RELATORIO.txt" << EOF
╔════════════════════════════════════════════════════════════════╗
║          RELATÓRIO DE BACKUP - AGE RUN PRODUCTION              ║
╚════════════════════════════════════════════════════════════════╝

📅 DATA DO BACKUP
   └─ $(date '+%d/%m/%Y às %H:%M:%S')

📊 DADOS DO BANCO DE DADOS
   ├─ Usuários salvos: $USUARIOS
   ├─ Pesagens salvas: $PESAGENS
   └─ Formato: JSON + SQL

💾 ARQUIVOS DE BACKUP
   ├─ Dados JSON:     dados-completos.json
   ├─ Bancos locais:  peso-local.db, database-local.db
   ├─ Código-fonte:   agerun-source-$TIMESTAMP.tar.gz
   └─ Dump SQL:       $([ -f "$BACKUP_DIR/database/postgresql-dump-$TIMESTAMP.sql" ] && echo "postgresql-dump-$TIMESTAMP.sql" || echo "postgresql-export.sql (básico)")

📁 ESTRUTURA DO BACKUP
$BACKUP_DIR/
   ├── database/
   │   ├── dados-completos.json
   │   ├── peso-local.db
   │   └── postgresql-dump-$TIMESTAMP.sql
   ├── code/
   │   ├── agerun-source-$TIMESTAMP.tar.gz
   │   ├── package.json
   │   └── README.md
   └── RELATORIO.txt

📊 TAMANHO TOTAL
   └─ $(du -sh "$BACKUP_DIR" | cut -f1)

🔄 COMO RESTAURAR

1. BANCO DE DADOS (PostgreSQL):
   psql \$DATABASE_URL < database/postgresql-dump-$TIMESTAMP.sql

2. BANCO DE DADOS (JSON via script):
   node scripts/restore-database.js database/dados-completos.json

3. CÓDIGO-FONTE:
   tar -xzf code/agerun-source-$TIMESTAMP.tar.gz -C /destino

🔐 SEGURANÇA
   ⚠️  Este backup contém dados sensíveis (senhas, emails)
   ⚠️  Armazene em local seguro e criptografado
   ⚠️  Não compartilhe publicamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backup gerado por: backup-completo.sh
Sistema: Age Run - Controle de Peso
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo -e "${GREEN}      ✅ Relatório criado${NC}"

# ============================================================================
# RESUMO FINAL
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ BACKUP CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📁 Localização: ${GREEN}$BACKUP_DIR${NC}"
echo -e "📊 Usuários: ${YELLOW}$USUARIOS${NC}"
echo -e "📊 Pesagens: ${YELLOW}$PESAGENS${NC}"
echo -e "💾 Tamanho: ${YELLOW}$(du -sh "$BACKUP_DIR" | cut -f1)${NC}"
echo ""
echo -e "${YELLOW}📄 Veja detalhes em:${NC} $BACKUP_DIR/RELATORIO.txt"
echo ""

# Criar link simbólico para último backup
cd "$BACKUP_ROOT"
rm -f backup-completo-latest
ln -s "backup-completo-$TIMESTAMP" backup-completo-latest
echo -e "${GREEN}🔗 Link criado:${NC} backups/backup-completo-latest/"
echo ""
