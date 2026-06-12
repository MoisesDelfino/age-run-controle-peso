# Copilot Instructions - Age Run Controle de Peso

## Escopo e isolamento

- Atuar apenas neste repositorio.
- Nao criar, editar ou remover arquivos fora deste workspace.
- Em caso de duvida, listar arquivos-alvo antes de editar.
- Nao tocar nos backups em `storage/snapshots/` sem solicitacao explicita.

## Contexto do sistema

- Aplicacao web para controle de peso, bioimpedancia, monitoramento e ranking.
- Stack principal: PHP + JavaScript + HTML/CSS + SQL.
- Base path esperado em producao: `/controle`.
- Fluxos criticos: autenticacao, confirmacao de e-mail, recuperacao de senha, pesagem, bioimpedancia e ranking.
- Endpoints existentes incluem `POST /api/auth/login`, `POST /api/auth/cadastro`, `POST /api/pesagens`, `GET /api/ranking`.

## Convencoes obrigatorias

- Preservar contratos existentes entre frontend e endpoints PHP.
- Evitar alteracoes amplas em arquivos sem necessidade.
- Priorizar correcao minima com diff pequeno e rastreavel.
- Nao misturar refatoracao estrutural com mudanca de regra de negocio no mesmo passo.
- Manter arquivos raiz e `public/` sincronizados quando alterar assets/paginas usados pelo deploy.

## Seguranca minima

- Validar entrada de usuario antes de persistir ou processar.
- Nao concatenar SQL com entrada direta.
- Nao vazar dados sensiveis em mensagens de erro ou logs.
- Revisar fluxos de login, recuperar senha e primeiro acesso com prioridade.
- Nao commitar segredos de `.env` (SMTP, DB, session secret).

## Testes e validacao

- Validacoes tecnicas recomendadas:
  - `php -l src/**/*.php` (lint PHP por arquivo alterado)
  - `php -l public/index.php`
  - `sh sync-public.sh` quando alterar arquivos listados no script
- Quando possivel, validar manualmente os fluxos:
  - login
  - confirmacao de e-mail
  - cadastro/primeiro acesso
  - recuperar e redefinir senha
  - pesagem
  - bioimpedancia
  - ranking
- Declarar explicitamente o que nao foi possivel validar localmente.

## Definicao de pronto

- Mudanca restrita ao escopo solicitado.
- Sem quebra funcional conhecida dos fluxos criticos.
- Riscos residuais e proximos passos documentados na resposta final.
- Se houve mudanca de rota/contrato, listar impacto no frontend explicitamente.
