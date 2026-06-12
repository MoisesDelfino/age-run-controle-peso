---
description: "Iniciar tarefa no Age Run com Workflow First estrito"
name: "Start Age Run (Workflow First)"
argument-hint: "Descreva o objetivo da tarefa"
agent: "agent"
---
Projeto alvo: Age Run Controle de Peso
Escopo: somente este workspace

Use workflow first estrito e conduza a tarefa neste formato:
1. Objetivo
2. Escopo
3. Menor passo seguro
4. Validacao
5. Riscos e proximos passos

Regras obrigatorias:
- Preservar contratos entre frontend e endpoints PHP.
- Nao editar fora do projeto.
- Nao tocar em `storage/snapshots/` sem solicitacao explicita.
- Fazer mudancas pequenas e revisaveis.

Validacao minima:
- `php -l` nos arquivos PHP alterados
- `sh sync-public.sh` quando alterar arquivos espelhados em `public/`
- Check manual dos fluxos impactados (auth/pesagem/bioimpedancia/ranking)

Tarefa:
{{input}}

No fim da primeira resposta:
- Proponha um plano curto
- Execute apenas o passo 1 e pare para revisao
