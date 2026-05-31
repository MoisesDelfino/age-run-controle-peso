<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Execute este script via CLI.\n");
    exit(1);
}

require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/helpers.php';

if ($argc < 4) {
    fwrite(STDERR, "Uso:\n");
    fwrite(STDERR, "php scripts/repair_usuario_email.php <email> <nome_canonico> <nova_senha> [--dry-run]\n");
    exit(1);
}

[$script, $email, $nomeCanonico, $novaSenha] = $argv;
$email = strtolower(trim((string) $email));
$nomeCanonico = trim((string) $nomeCanonico);
$novaSenha = (string) $novaSenha;
$dryRun = in_array('--dry-run', $argv, true);

if ($email === '' || $nomeCanonico === '' || $novaSenha === '') {
    fwrite(STDERR, "Email, nome e senha são obrigatórios.\n");
    exit(1);
}

$matches = dbFetchAll(
    'SELECT id, nome, email FROM usuarios WHERE LOWER(email) = LOWER(:email) ORDER BY id',
    [':email' => $email]
);

if ($matches === []) {
    fwrite(STDERR, "Nenhum usuário encontrado para: {$email}\n");
    exit(1);
}

$keeper = null;
foreach ($matches as $row) {
    if (strtolower(trim((string) ($row['nome'] ?? ''))) === strtolower($nomeCanonico)) {
        $keeper = $row;
        break;
    }
}

if ($keeper === null) {
    $keeper = $matches[0];
}

$keeperId = (int) ($keeper['id'] ?? 0);
$duplicateIds = [];
foreach ($matches as $row) {
    $rowId = (int) ($row['id'] ?? 0);
    if ($rowId > 0 && $rowId !== $keeperId) {
        $duplicateIds[] = $rowId;
    }
}

$senhaHash = password_hash($novaSenha, PASSWORD_DEFAULT);

echo "Usuário mantido: #{$keeperId} " . ($keeper['nome'] ?? '') . " <" . ($keeper['email'] ?? '') . ">\n";
if ($duplicateIds !== []) {
    echo 'Duplicados a remover: ' . implode(', ', $duplicateIds) . "\n";
} else {
    echo "Nenhum duplicado encontrado.\n";
}

if ($dryRun) {
    echo "Dry-run concluído. Nenhuma alteração aplicada.\n";
    exit(0);
}

$pdo = db();

try {
    $pdo->beginTransaction();

    if ($duplicateIds !== []) {
        $placeholders = implode(',', array_fill(0, count($duplicateIds), '?'));
        $params = array_merge([$keeperId], $duplicateIds);

        dbExecute("UPDATE pesagens SET usuario_id = ? WHERE usuario_id IN ({$placeholders})", $params);
        dbExecute("UPDATE rp_testes_historico SET usuario_id = ? WHERE usuario_id IN ({$placeholders})", $params);
        dbExecute("UPDATE rp_testes_historico SET treinador_id = ? WHERE treinador_id IN ({$placeholders})", $params);
        dbExecute("DELETE FROM usuarios WHERE id IN ({$placeholders})", $duplicateIds);
    }

    dbExecute(
        'UPDATE usuarios
         SET nome = :nome,
             email = :email,
             senha = :senha,
             codigo_recuperacao = NULL,
             codigo_expiracao = NULL
         WHERE id = :id',
        [
            ':nome' => $nomeCanonico,
            ':email' => $email,
            ':senha' => $senhaHash,
            ':id' => $keeperId,
        ]
    );

    $pdo->commit();

    echo "Reparo concluído com sucesso.\n";
    echo "Senha redefinida para o usuário mantido e duplicados removidos, se existiam.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fwrite(STDERR, 'Falha no reparo: ' . $e->getMessage() . "\n");
    exit(1);
}