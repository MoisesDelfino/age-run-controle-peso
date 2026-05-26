# 🔐 Guia de Backup Completo - Age Run

## 📋 Visão Geral

Este sistema realiza backup completo de **todos os dados de produção**, incluindo:
- ✅ Banco de dados PostgreSQL (Render)
- ✅ Dados em formato JSON
- ✅ Código-fonte da aplicação
- ✅ Bancos de dados locais (SQLite)
- ✅ Relatório detalhado

---

## 🚀 Como Fazer Backup

### Método 1: Script Automatizado (Recomendado)

```bash
# Execute o script de backup completo
./scripts/backup-completo.sh
```

**O que acontece:**
1. Conecta ao PostgreSQL de produção
2. Exporta dados para JSON
3. Cria dump SQL do banco
4. Copia bancos locais
5. Compacta código-fonte
6. Gera relatório detalhado

### Método 2: Backup Manual por Partes

**1. Backup do Banco de Dados (JSON):**
```bash
node scripts/backup-database.js
```

**2. Backup do Banco de Dados (SQL):**
```bash
# Configure DATABASE_URL no .env e execute:
pg_dump $DATABASE_URL > backup-$(date +%Y-%m-%d).sql
```

**3. Backup do Código:**
```bash
tar -czf agerun-backup.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backups' \
    .
```

---

## 📊 Último Backup Realizado

**Data:** 20/05/2026 às 17:14:17

**Estatísticas:**
- 👥 **14 usuários** salvos
- 📊 **35 pesagens** ativas
- 📈 **38 pesagens** totais (incluindo excluídas)
- 💾 **256 KB** de dados

**Localização:**
```
backups/backup-completo-2026-05-20_17-13-54/
```

**Acesso rápido:**
```
backups/backup-completo-latest/  → Link simbólico para último backup
```

---

## 📁 Estrutura do Backup

```
backup-completo-YYYY-MM-DD_HH-MM-SS/
├── database/
│   ├── dados-completos.json          # Dados em JSON (usuários + pesagens)
│   ├── peso-local.db                 # SQLite local
│   ├── database-local.db             # SQLite alternativo
│   └── postgresql-dump-*.sql         # Dump completo do PostgreSQL
│
├── code/
│   ├── agerun-source-*.tar.gz        # Código-fonte compactado
│   ├── package.json                  # Dependências
│   └── README.md                     # Documentação
│
├── logs/                             # Logs do processo (vazio por padrão)
│
└── RELATORIO.txt                     # Relatório detalhado do backup
```

---

## 🔄 Como Restaurar

### 1. Restaurar Banco de Dados (PostgreSQL)

**Opção A: Via SQL Dump**
```bash
# Restaurar dump completo
psql $DATABASE_URL < database/postgresql-dump-YYYY-MM-DD.sql
```

**Opção B: Via JSON (Script)**
```bash
# Restaurar usando script Node.js
node scripts/restore-database.js database/dados-completos.json
```

**Opção C: Manualmente via psql**
```bash
# Conectar ao banco
psql $DATABASE_URL

# Limpar dados existentes (CUIDADO!)
TRUNCATE TABLE pesagens, usuarios CASCADE;

# Importar SQL
\i database/postgresql-dump-YYYY-MM-DD.sql
```

### 2. Restaurar Código-Fonte

```bash
# Extrair arquivo compactado
tar -xzf code/agerun-source-*.tar.gz -C /destino

# Instalar dependências
cd /destino
npm install

# Configurar .env
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Restaurar Banco Local (SQLite)

```bash
# Copiar banco de dados
cp database/peso-local.db ./peso.db
```

---

## ⚙️ Configuração

### Pré-requisitos

1. **Node.js** instalado
2. **PostgreSQL** client tools (opcional para pg_dump)
3. **DATABASE_URL** configurado no `.env`

### Configurar DATABASE_URL

**Para backup de produção:**
```bash
# Edite .env e descomente a linha:
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
```

**Para desenvolvimento (local):**
```bash
# Comente a linha DATABASE_URL para usar SQLite
#DATABASE_URL=postgresql://...
```

---

## 🔐 Segurança

### ⚠️ IMPORTANTE

- ❌ **NÃO** compartilhe backups publicamente
- ❌ **NÃO** commite backups no Git (.gitignore os protege)
- ✅ Armazene backups em local seguro
- ✅ Criptografe backups antes de mover
- ✅ Mantenha múltiplas cópias (local + nuvem)

### Dados Sensíveis nos Backups

Os backups contêm:
- 🔑 Senhas hasheadas (bcrypt)
- 📧 E-mails dos usuários
- 📊 Dados pessoais (peso, altura)
- 🗄️ Estrutura completa do banco

### Criptografar Backup

```bash
# Criptografar com senha
zip -e -r backup-seguro.zip backups/backup-completo-latest/

# Ou usar GPG
tar -czf - backups/backup-completo-latest/ | gpg -c > backup.tar.gz.gpg
```

---

## 📅 Backups Automáticos

### Sistema Atual

O sistema já possui backup automático JSON configurado em:
- **Script:** `scripts/auto-backup.js`
- **Frequência:** Diário
- **Destino:** `backups/backup-YYYY-MM-DDTHH-MM-SS.json`
- **Retenção:** Mantém `backup-latest.json` sempre atualizado

### Agendar Backup Completo (Cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha para backup diário às 3h da manhã
0 3 * * * cd /path/to/agerun && ./scripts/backup-completo.sh >> backups/cron.log 2>&1

# Ou backup semanal (domingo às 2h)
0 2 * * 0 cd /path/to/agerun && ./scripts/backup-completo.sh >> backups/cron.log 2>&1
```

---

## 🧪 Testar Backup/Restore

### 1. Fazer Backup de Teste

```bash
./scripts/backup-completo.sh
```

### 2. Criar Banco de Teste

```bash
# Criar banco vazio
createdb age_run_test

# Restaurar backup
psql postgresql://localhost/age_run_test < backups/backup-completo-latest/database/postgresql-dump-*.sql
```

### 3. Verificar Dados

```bash
psql postgresql://localhost/age_run_test

-- Contar registros
SELECT COUNT(*) FROM usuarios;
SELECT COUNT(*) FROM pesagens;

-- Verificar últimas pesagens
SELECT u.nome, p.peso, p.data_pesagem 
FROM pesagens p 
JOIN usuarios u ON p.usuario_id = u.id 
ORDER BY p.data_pesagem DESC 
LIMIT 10;
```

---

## 📊 Monitoramento

### Verificar Backups Existentes

```bash
# Listar todos os backups
ls -lh backups/

# Ver tamanho total dos backups
du -sh backups/

# Contar backups
ls backups/backup-completo-* | wc -l
```

### Verificar Último Backup

```bash
# Ver relatório
cat backups/backup-completo-latest/RELATORIO.txt

# Ver dados salvos
node -e "const b = require('./backups/backup-latest.json'); console.log('Usuários:', b.stats.total_usuarios, 'Pesagens:', b.stats.total_pesagens);"
```

---

## 🆘 Solução de Problemas

### Erro: "DATABASE_URL not found"

**Solução:**
```bash
# Descomente DATABASE_URL no .env
nano .env
# Remova o # da linha DATABASE_URL
```

### Erro: "pg_dump: command not found"

**Solução:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# O script continua funcionando com backup JSON mesmo sem pg_dump
```

### Erro: "Permission denied"

**Solução:**
```bash
# Dar permissão de execução
chmod +x scripts/backup-completo.sh
```

### Backup Muito Grande

**Soluções:**
- Limpar backups antigos:
  ```bash
  # Manter apenas últimos 7 dias
  find backups/ -name "backup-completo-*" -mtime +7 -delete
  ```
- Comprimir mais:
  ```bash
  tar -cJf backup.tar.xz backups/  # Usa xz (mais compressão)
  ```

---

## 📋 Checklist de Backup

Antes de fazer mudanças importantes:

- [ ] Fazer backup completo
- [ ] Verificar tamanho do backup (deve ser ~260 KB)
- [ ] Confirmar número de usuários e pesagens
- [ ] Testar restauração em ambiente de teste
- [ ] Armazenar backup em local seguro
- [ ] Documentar mudanças no RELATORIO.txt

---

## 🔗 Scripts Relacionados

- `scripts/backup-completo.sh` - Backup completo (este guia)
- `scripts/backup-database.js` - Backup JSON apenas
- `scripts/restore-database.js` - Restaurar a partir de JSON
- `scripts/auto-backup.js` - Backup automático (cron)
- `scripts/restore-sqlite.js` - Restaurar para SQLite local

---

## 📞 Suporte

Em caso de dúvidas ou problemas com backup:

1. Verifique logs em `backups/backup-completo-latest/logs/`
2. Leia o RELATORIO.txt do último backup
3. Consulte documentação do PostgreSQL
4. Teste em ambiente local primeiro

---

**Última atualização:** 20/05/2026
**Versão do sistema:** Age Run v1.0
**Documentação por:** backup-completo.sh
