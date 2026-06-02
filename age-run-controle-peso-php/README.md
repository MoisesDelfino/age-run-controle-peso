# Age Run Controle de Peso (PHP)

Este projeto foi criado em pasta separada para replicar o sistema atual em PHP sem alterar o projeto Node existente.
O alvo deste pacote e rodar no dominio principal em `/controle`.

## Estrutura

- `public/`: frontend original copiado (HTML/CSS/JS/imagens) + roteador `index.php`
- `src/`: backend PHP (rotas, sessão, banco, recuperação de senha, confirmação de e-mail)
- `database.sql`: schema para MySQL/MariaDB
- `scripts/migrate_sqlite_to_mysql.php`: migração opcional de dados SQLite para MySQL

## Requisitos no Plesk

- PHP 8.1+
- Extensões: `pdo`, `pdo_mysql` (ou `pdo_pgsql` / `pdo_sqlite`, conforme banco)
- Apache com `mod_rewrite`

## Setup rápido

1. Criar banco MySQL/MariaDB no Plesk.
2. Importar `database.sql` no banco novo.
3. Copiar `.env.example` para `.env` e preencher dados de conexão.
4. Criar uma conta de e-mail no Plesk, como `no-reply@seu-dominio.com`, e usar essa conta no SMTP.
4. No Gerenciador de Arquivos do dominio principal, crie/abra a pasta `controle`.
5. Publique o conteudo deste projeto dentro de `httpdocs/controle`.
6. Não é necessario usar subdominio.

## Variáveis `.env`

Use como base:

```
APP_ENV=production
APP_BASE_PATH=/controle
APP_URL=https://seu-dominio.com
SESSION_NAME=age_run.sid
SESSION_SECRET=troque-este-segredo

DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=age_run
DB_USERNAME=age_run_user
DB_PASSWORD=senha_forte
DB_CHARSET=utf8mb4

EMAIL_FROM_NAME=Age Run
EMAIL_FROM_ADDRESS=no-reply@seu-dominio.com
EMAIL_REPLY_TO_NAME=Age Run
EMAIL_REPLY_TO_ADDRESS=suporte@seu-dominio.com
EMAIL_TRANSPORT=smtp
SMTP_HOST=mail.seu-dominio.com
SMTP_PORT=587
SMTP_ENCRYPTION=tls
SMTP_USERNAME=no-reply@seu-dominio.com
SMTP_PASSWORD=troque-esta-senha
SMTP_TIMEOUT=15
```

Para deploy em `/controle`, use:

```
APP_BASE_PATH=/controle
APP_URL=https://seu-dominio.com
```

## SMTP no Plesk

Campos que você precisa copiar do painel:

- Conta de e-mail criada em `Mail`: use como `SMTP_USERNAME` e também em `EMAIL_FROM_ADDRESS`
- Senha da conta: use em `SMTP_PASSWORD`
- Servidor de saída SMTP: use em `SMTP_HOST`
- Porta SMTP: normalmente `587` com `TLS` ou `465` com `SSL`
- Endereço de suporte opcional: use em `EMAIL_REPLY_TO_ADDRESS`

Configuração recomendada:

- `EMAIL_TRANSPORT=smtp`
- `EMAIL_FROM_ADDRESS=no-reply@seu-dominio.com`
- `SMTP_PORT=587`
- `SMTP_ENCRYPTION=tls`

No Plesk, valide também:

- `SPF` ativo para o domínio
- `DKIM` ativo para o domínio
- `DMARC` configurado, se disponível

Sem isso, os e-mails podem cair em spam mesmo com SMTP correto.

## Rotas compatíveis implementadas

- `POST /api/auth/cadastro`
- `POST /api/auth/reenviar-confirmacao`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /confirmar-email?token=...`
- `POST /api/auth/solicitar-recuperacao`
- `POST /api/auth/redefinir-senha`
- `POST /api/pesagens`
- `GET /api/ranking`
- `GET /api/pesagens/usuario/:id`
- `GET /api/meu-historico`
- `PUT /api/usuarios/altura`
- `GET /api/estatisticas`
- `PUT /api/pesagens/:id`
- `DELETE /api/pesagens/:id`
- `POST /api/pesagens/:id/restaurar`
- `GET /api/pesagens/excluidas/:id`

## Migração de dados (SQLite -> MySQL)

Se o sistema atual estiver em SQLite:

1. Snapshots preservados em `storage/snapshots/`:
	- `peso.current.2026-05-25.db` (estado atual recomendado para migração)
	- `peso.head.2026-05-25.db` (estado do commit HEAD para rollback/auditoria)
	- `SHA256SUMS.txt` (integridade dos arquivos)
2. Execute no terminal usando o snapshot atual:

```
php scripts/migrate_sqlite_to_mysql.php storage/snapshots/peso.current.2026-05-25.db 127.0.0.1 age_run age_run_user senha 3306
```

Alternativa para Plesk/phpMyAdmin (sem CLI):

1. Use o arquivo `storage/snapshots/peso.current.2026-05-25.mysql.sql`.
2. No phpMyAdmin do banco novo, abra a aba Importar e envie esse arquivo.

## Reparo pontual de usuário

Se for necessário corrigir um cadastro em produção, use o script CLI abaixo no servidor com o `.env` correto carregado:

```
php scripts/repair_usuario_email.php luccanoventa@gmail.com "LUCAS DO NASCIMENTO PACHECO" "@agerun01"
```

Antes de aplicar, você pode testar sem gravar nada com `--dry-run`.

Se o servidor não oferecer CLI no Plesk, use a página temporária em `/controle/repair-usuario-email.php?token=SEU_TOKEN`, depois de configurar `IMPORT_TOKEN` ou `REPAIR_TOKEN` no ambiente. Acesse primeiro em modo simulação, depois desmarque a opção de dry-run e remova o arquivo após o uso.

## PostgreSQL sem phpPgAdmin/Webadmin

Se o painel nao oferecer interface web para importar SQL no PostgreSQL:

1. Configure o `.env` com `DB_DRIVER=pgsql` e credenciais do banco.
2. Abra no navegador: `/controle/import_pgsql.php`
3. Clique em `Executar importacao PostgreSQL`.
4. Ao finalizar com sucesso, remova `import_pgsql.php` por seguranca.

## Observações

- O frontend foi mantido para preservar comportamento visual e chamadas existentes.
- Cadastro novo agora exige confirmação de e-mail antes do primeiro login.
- Usuários antigos são preservados como já verificados para evitar bloqueio retroativo.
- O projeto Node atual permanece intacto.
- Este pacote já está preparado para coexistir com o sistema atual usando `https://seu-dominio.com/controle`.
