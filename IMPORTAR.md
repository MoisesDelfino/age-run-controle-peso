# 📊 Como Importar Dados da Planilha

Se você já tem dados na planilha do Google Sheets e quer migrar para o sistema online, siga este guia.

## 🎯 Opção 1: Usar o Script de Importação (Recomendado)

Já incluímos os dados da sua planilha atual no projeto!

### Passos:

```bash
# 1. Parar o servidor se estiver rodando (Ctrl+C)

# 2. Executar o script de importação
node scripts/importar-planilha.js

# 3. Reiniciar o servidor
npm start

# 4. Acessar http://localhost:3000
```

**Pronto!** Todos os dados da planilha estarão no sistema 🎉

---

## 📝 Opção 2: Importação Manual

Se preferir importar os dados manualmente ou adicionar novos participantes:

1. Acesse o sistema: http://localhost:3000
2. Para cada pessoa da planilha:
   - Digite o nome
   - Digite o peso atual
   - Clique em "Registrar Pesagem"

---

## 🔄 Atualizar Script com Novos Dados

Para adicionar novos participantes ao script de importação:

1. Abra o arquivo: `scripts/importar-planilha.js`
2. Adicione novos dados no array `dadosPlanilha`:

```javascript
const dadosPlanilha = [
    { nome: "Nome da Pessoa", pesoInicial: 80.0, pesoAtual: 75.5 },
    // Adicione mais aqui...
];
```

3. Execute novamente: `node scripts/importar-planilha.js`

---

## 📅 Datas das Pesagens

O script importa:
- **Peso Inicial**: Janeiro de 2025 (data de referência da planilha)
- **Peso Atual**: Maio de 2026 (data atual)

Após a importação, cada pessoa pode continuar registrando novas pesagens normalmente pelo sistema.

---

## ⚠️ Observações

- O script **não duplica** dados. Se você executar novamente, ele tentará inserir apenas dados novos.
- Os nomes devem ser **exatamente iguais** aos da planilha para evitar duplicações.
- Depois da importação, recomendamos que cada pessoa use sempre o mesmo nome para registrar novas pesagens.

---

## 🆘 Problemas?

### "Usuário já existe"

Isso é normal! O script ignora usuários duplicados automaticamente.

### "Erro ao conectar ao banco"

Certifique-se que o arquivo `peso.db` existe. Se não existir:

```bash
npm run init-db
```

### Quero recomeçar do zero

Para apagar todos os dados e começar novamente:

```bash
rm peso.db
npm run init-db
node scripts/importar-planilha.js
```

---

## 🎉 Pronto!

Agora você pode abandonar a planilha e usar apenas o sistema online! 💪
