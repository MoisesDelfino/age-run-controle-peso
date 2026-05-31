<?php

declare(strict_types=1);

$bootstrapCandidates = [
    __DIR__ . '/src/config.php',
    __DIR__ . '/../src/config.php',
];

$loaded = false;
foreach ($bootstrapCandidates as $candidate) {
    if (is_file($candidate)) {
        require_once $candidate;
        $loaded = true;
        break;
    }
}

if (!$loaded) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Bootstrap config.php nao encontrado.';
    exit;
}

$dbCandidates = [
    __DIR__ . '/src/db.php',
    __DIR__ . '/../src/db.php',
];

$loadedDb = false;
foreach ($dbCandidates as $candidate) {
    if (is_file($candidate)) {
        require_once $candidate;
        $loadedDb = true;
        break;
    }
}

if (!$loadedDb) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Bootstrap db.php nao encontrado.';
    exit;
}

require_once __DIR__ . '/src/helpers.php';

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function repairDbTableExists(string $table): bool
{
    $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

    if ($driver === 'sqlite') {
        $row = dbFetchOne('SELECT name FROM sqlite_master WHERE type = "table" AND name = :table LIMIT 1', [':table' => $table]);
        return $row !== null;
    }

    if ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
        $row = dbFetchOne(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = CURRENT_SCHEMA() AND table_name = :table LIMIT 1',
            [':table' => $table]
        );
        return $row !== null;
    }

    $row = dbFetchOne('SHOW TABLES LIKE :table', [':table' => $table]);
    return $row !== null;
}

function repairTokenValue(): string
{
    $token = trim((string) env('IMPORT_TOKEN', ''));
    if ($token === '') {
        $token = trim((string) env('REPAIR_TOKEN', ''));
    }
    return $token;
}

function repairTokenProvided(): string
{
    return trim((string) ($_GET['token'] ?? $_POST['token'] ?? ''));
}

function renderPage(string $title, string $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
    echo '<title>' . h($title) . '</title>';
    echo '<style>';
    echo 'body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px;}';
    echo '.box{max-width:860px;margin:0 auto;background:#111827;border:1px solid #334155;border-radius:14px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.28);}';
    echo 'h1{margin:0 0 12px;font-size:24px;}';
    echo 'label{display:block;margin:12px 0 6px;font-weight:700;}';
    echo 'input[type=text],input[type=password]{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;}';
    echo 'button{background:#22c55e;color:#052e16;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;margin-top:16px;}';
    echo '.muted{color:#94a3b8;font-size:14px;line-height:1.5;}';
    echo '.err{background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca;padding:12px;border-radius:10px;margin:16px 0;}';
    echo '.ok{background:#143122;border:1px solid #166534;color:#bbf7d0;padding:12px;border-radius:10px;margin:16px 0;}';
    echo '.warn{background:#3b2f12;border:1px solid #854d0e;color:#fde68a;padding:12px;border-radius:10px;margin:16px 0;}';
    echo 'code,pre{background:#0b1220;border:1px solid #334155;border-radius:10px;padding:12px;color:#cbd5e1;overflow:auto;}';
    echo 'table{width:100%;border-collapse:collapse;margin-top:12px;}';
    echo 'th,td{padding:10px;border-bottom:1px solid #1f2937;text-align:left;vertical-align:top;}';
    echo '.actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;}';
    echo '.checkbox{display:flex;gap:8px;align-items:center;margin-top:12px;}';
    echo '</style></head><body><div class="box">' . $body . '</div></body></html>';
    exit;
}

$expectedToken = repairTokenValue();
if ($expectedToken === '') {
    renderPage(
        'Reparo de usuário',
        '<h1>Reparo de usuário</h1><div class="warn">Defina <strong>IMPORT_TOKEN</strong> ou <strong>REPAIR_TOKEN</strong> no ambiente antes de usar este arquivo.</div>',
        500
    );
}

$providedToken = repairTokenProvided();
if ($providedToken === '' || !hash_equals($expectedToken, $providedToken)) {
    renderPage(
        'Acesso negado',
        '<h1>Acesso negado</h1><div class="err">Token inválido ou ausente.</div><p class="muted">Acesse este arquivo com o parâmetro <code>?token=...</code> correspondente ao token do ambiente.</p>',
        403
    );
}

$emailDefault = 'luccanoventa@gmail.com';
$nameDefault = 'LUCAS DO NASCIMENTO PACHECO';
$passwordDefault = '@agerun01';
$message = '';
$error = '';
$dryRun = true;
$resultRows = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim((string) ($_POST['email'] ?? $emailDefault)));
    $nomeCanonico = trim((string) ($_POST['nome_canonico'] ?? $nameDefault));
    $novaSenha = (string) ($_POST['nova_senha'] ?? $passwordDefault);
    $dryRun = !empty($_POST['dry_run']);

    if ($email === '' || $nomeCanonico === '' || $novaSenha === '') {
        $error = 'Email, nome e senha são obrigatórios.';
    } else {
        try {
            $matches = dbFetchAll(
                'SELECT id, nome, email FROM usuarios WHERE LOWER(email) = LOWER(:email) ORDER BY id',
                [':email' => $email]
            );

            if ($matches === []) {
                $error = 'Nenhum usuário encontrado para o e-mail informado.';
            } else {
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

                $resultRows = $matches;

                if (!$dryRun) {
                    $pdo = db();
                    $pdo->beginTransaction();

                    try {
                        if ($duplicateIds !== []) {
                            $placeholders = implode(',', array_fill(0, count($duplicateIds), '?'));
                            $params = array_merge([$keeperId], $duplicateIds);

                            if (repairDbTableExists('pesagens')) {
                                $stmt = $pdo->prepare("UPDATE pesagens SET usuario_id = ? WHERE usuario_id IN ({$placeholders})");
                                $stmt->execute($params);
                            }

                            if (repairDbTableExists('rp_testes_historico')) {
                                $stmt = $pdo->prepare("UPDATE rp_testes_historico SET usuario_id = ? WHERE usuario_id IN ({$placeholders})");
                                $stmt->execute($params);

                                $stmt = $pdo->prepare("UPDATE rp_testes_historico SET treinador_id = ? WHERE treinador_id IN ({$placeholders})");
                                $stmt->execute($params);
                            }

                            $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id IN ({$placeholders})");
                            $stmt->execute($duplicateIds);
                        }

                        $stmt = $pdo->prepare(
                            'UPDATE usuarios
                             SET nome = :nome,
                                 email = :email,
                                 senha = :senha,
                                 codigo_recuperacao = NULL,
                                 codigo_expiracao = NULL
                             WHERE id = :id'
                        );
                        $stmt->execute([
                            ':nome' => $nomeCanonico,
                            ':email' => $email,
                            ':senha' => password_hash($novaSenha, PASSWORD_DEFAULT),
                            ':id' => $keeperId,
                        ]);

                        $pdo->commit();
                        $message = 'Reparo aplicado com sucesso.';
                    } catch (Throwable $e) {
                        if ($pdo->inTransaction()) {
                            $pdo->rollBack();
                        }
                        throw $e;
                    }
                } else {
                    $message = 'Dry-run concluído. Nenhuma alteração foi gravada.';
                }
            }
        } catch (Throwable $e) {
            $error = 'Falha no reparo: ' . $e->getMessage();
        }
    }
}

$tokenParam = urlencode($providedToken);
$body = '<h1>Reparo de usuário</h1>';
$body .= '<p class="muted">Use esta página apenas para corrigir a produção quando não houver CLI disponível.</p>';
$body .= '<div class="warn">Depois de usar, remova este arquivo do servidor.</div>';

if ($message !== '') {
    $body .= '<div class="ok">' . h($message) . '</div>';
}

if ($error !== '') {
    $body .= '<div class="err">' . h($error) . '</div>';
}

$body .= '<form method="post" action="?token=' . $tokenParam . '">';
$body .= '<label for="email">E-mail</label>';
$body .= '<input id="email" name="email" type="text" value="' . h((string) ($_POST['email'] ?? $emailDefault)) . '">';
$body .= '<label for="nome_canonico">Nome canônico</label>';
$body .= '<input id="nome_canonico" name="nome_canonico" type="text" value="' . h((string) ($_POST['nome_canonico'] ?? $nameDefault)) . '">';
$body .= '<label for="nova_senha">Nova senha</label>';
$body .= '<input id="nova_senha" name="nova_senha" type="password" value="' . h((string) ($_POST['nova_senha'] ?? $passwordDefault)) . '">';
$body .= '<div class="checkbox"><input id="dry_run" name="dry_run" type="checkbox" value="1"' . ($dryRun ? ' checked' : '') . '><label for="dry_run" style="margin:0;font-weight:400;">Executar apenas simulação</label></div>';
$body .= '<div class="actions"><button type="submit">Executar reparo</button></div>';
$body .= '</form>';

if ($resultRows !== []) {
    $body .= '<h2>Registros encontrados</h2>';
    $body .= '<table><thead><tr><th>ID</th><th>Nome</th><th>E-mail</th></tr></thead><tbody>';
    foreach ($resultRows as $row) {
        $body .= '<tr><td>' . h((string) ($row['id'] ?? '')) . '</td><td>' . h((string) ($row['nome'] ?? '')) . '</td><td>' . h((string) ($row['email'] ?? '')) . '</td></tr>';
    }
    $body .= '</tbody></table>';
}

$body .= '<p class="muted">Se o token estiver configurado em <code>IMPORT_TOKEN</code> ou <code>REPAIR_TOKEN</code>, acesse com <code>?token=SEU_TOKEN</code>.</p>';

renderPage('Reparo de usuário', $body);