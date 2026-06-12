# Skill Local: Age Run Domain Guardrails

## Quando usar

- Mudancas em cadastro, autenticacao, pesagem, bioimpedancia, ranking ou monitoramento.
- Mudancas em scripts de suporte: `import_pgsql.php`, `repair-usuario-email.php`, `scripts/`.

## Passos operacionais

1. Confirmar escopo do fluxo impactado.
2. Identificar arquivos de UI e backend envolvidos (`*.html`, `*.js`, `src/`, `router.php`).
3. Aplicar correcao minima sem alterar contratos publicos desnecessariamente.
4. Revisar validacao de entrada, sessao e mensagens de erro.
5. Rodar lint PHP nos arquivos alterados e sincronizar `public/` se necessario.
6. Validar fluxo funcional ponta a ponta da area alterada.

## Checklist rapido

- Login e recuperacao de senha permanecem funcionando
- Confirmacao de e-mail e primeiro acesso sem regressao
- Campos de medidas com validacao consistente
- Ranking e monitoramento sem regressao visivel
- Arquivos espelhados em `public/` atualizados quando aplicavel
- Sem alteracoes fora do escopo solicitado
