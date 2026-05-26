<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/email.php';

set_exception_handler(static function (Throwable $e): void {
    $cfg = appConfig();
    $isDebug = ($cfg['app_env'] ?? 'production') !== 'production';
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $isApi = str_contains($uriPath, '/api/');

    error_log('[AgeRun PHP] Unhandled exception: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());

    if ($isApi || str_contains($accept, 'application/json')) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        $payload = ['error' => 'Erro interno do servidor'];
        if ($isDebug) {
            $payload['debug'] = $e->getMessage();
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return;
    }

    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo $isDebug ? ('Erro interno do servidor: ' . $e->getMessage()) : 'Erro interno do servidor';
});

setupSession();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = getRequestPath();

const RACE_COLUMNS = ['rp_5k', 'rp_10k', 'rp_21k', 'rp_42k'];
const RP_STATUS_COLUMNS = [
    'rp_5k' => 'rp_5k_status',
    'rp_10k' => 'rp_10k_status',
    'rp_21k' => 'rp_21k_status',
    'rp_42k' => 'rp_42k_status',
];
const RP_APPROVAL_STATUSES = ['pendente', 'aprovado', 'reprovado'];
const RACE_DISTANCES = [
    'rp_5k' => 5,
    'rp_10k' => 10,
    'rp_21k' => 21.0975,
    'rp_42k' => 42.195,
];
const TRAINER_OVERRIDE_EMAILS = [
    'moisescamposdelfino@gmail.com',
];

function isTrainerOverrideEmail(?string $email): bool
{
    $normalized = strtolower(trim((string) $email));
    if ($normalized === '') {
        return false;
    }

    return in_array($normalized, TRAINER_OVERRIDE_EMAILS, true);
}

function dbColumnExists(string $table, string $column): bool
{
    $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

    if ($driver === 'sqlite') {
        $rows = dbFetchAll("PRAGMA table_info({$table})");
        foreach ($rows as $row) {
            if (($row['name'] ?? '') === $column) {
                return true;
            }
        }
        return false;
    }

    if ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
        $row = dbFetchOne(
            'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column LIMIT 1',
            [':table' => $table, ':column' => $column]
        );
        return $row !== null;
    }

    $rows = dbFetchAll("SHOW COLUMNS FROM {$table} LIKE :column", [':column' => $column]);
    return count($rows) > 0;
}

function ensureUsuariosCompatibilityColumns(): void
{
    $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

    $missing = [];
    $targetColumns = [
        'perfil' => "VARCHAR(20) DEFAULT 'aluno'",
        'rp_5k_status' => "VARCHAR(20) DEFAULT NULL",
        'rp_10k_status' => "VARCHAR(20) DEFAULT NULL",
        'rp_21k_status' => "VARCHAR(20) DEFAULT NULL",
        'rp_42k_status' => "VARCHAR(20) DEFAULT NULL",
    ];

    foreach ($targetColumns as $column => $definition) {
        if (!dbColumnExists('usuarios', $column)) {
            $missing[$column] = $definition;
        }
    }

    foreach ($missing as $column => $definition) {
        try {
            if ($driver === 'sqlite') {
                dbExecute("ALTER TABLE usuarios ADD COLUMN {$column} {$definition}");
            } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
                dbExecute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS {$column} {$definition}");
            } else {
                dbExecute("ALTER TABLE usuarios ADD COLUMN {$column} {$definition}");
            }
        } catch (Throwable $e) {
            // Coluna pode ter sido criada em corrida por outra requisição.
        }
    }

    try {
        dbExecute("UPDATE usuarios SET perfil = 'aluno' WHERE perfil IS NULL OR TRIM(perfil) = ''");
    } catch (Throwable $e) {
        // Ignorar em caso de ambientes sem coluna ainda visível.
    }
}

function parseRaceTimeToSeconds(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_numeric($value)) {
        $parsed = (int) round((float) $value);
        return $parsed > 0 ? $parsed : null;
    }

    $raw = trim((string) $value);
    if ($raw === '') {
        return null;
    }

    if (str_contains($raw, ':')) {
        $parts = array_map('trim', explode(':', $raw));
        $numbers = array_map(static fn($part) => is_numeric($part) ? (int) $part : -1, $parts);
        foreach ($numbers as $n) {
            if ($n < 0) {
                return -1;
            }
        }

        if (count($numbers) === 2) {
            [$minutes, $seconds] = $numbers;
            if ($seconds >= 60) {
                return -1;
            }
            return ($minutes * 60) + $seconds;
        }

        if (count($numbers) === 3) {
            [$hours, $minutes, $seconds] = $numbers;
            if ($minutes >= 60 || $seconds >= 60) {
                return -1;
            }
            return ($hours * 3600) + ($minutes * 60) + $seconds;
        }

        return -1;
    }

    if (!is_numeric($raw)) {
        return -1;
    }

    $parsed = (int) $raw;
    return $parsed > 0 ? $parsed : -1;
}

function formatSecondsToRaceTime(mixed $seconds): ?string
{
    if ($seconds === null || $seconds === '' || !is_numeric($seconds)) {
        return null;
    }

    $total = max(0, (int) round((float) $seconds));
    $hours = (int) floor($total / 3600);
    $minutes = (int) floor(($total % 3600) / 60);
    $remaining = $total % 60;

    if ($hours > 0) {
        return sprintf('%02d:%02d:%02d', $hours, $minutes, $remaining);
    }

    return sprintf('%02d:%02d', $minutes, $remaining);
}

function formatPace(mixed $secondsPerKm): ?string
{
    if ($secondsPerKm === null || !is_numeric($secondsPerKm)) {
        return null;
    }

    $value = (float) $secondsPerKm;
    if ($value <= 0) {
        return null;
    }

    $rounded = (int) round($value);
    $minutes = (int) floor($rounded / 60);
    $seconds = $rounded % 60;
    return sprintf('%02d:%02d /km', $minutes, $seconds);
}

function calculatePerformanceScore(array $user): ?float
{
    $weightedPaceSum = 0.0;
    $weightTotal = 0.0;

    foreach (RACE_DISTANCES as $column => $distanceKm) {
        $value = isset($user[$column]) && is_numeric($user[$column]) ? (float) $user[$column] : 0.0;
        if ($value <= 0) {
            continue;
        }

        $pace = $value / $distanceKm;
        $weightedPaceSum += $pace * $distanceKm;
        $weightTotal += $distanceKm;
    }

    if ($weightTotal <= 0) {
        return null;
    }

    return $weightedPaceSum / $weightTotal;
}

function mapRunnerForGroup(array $user, float $myScore): array
{
    $score = calculatePerformanceScore($user);
    $deltaPercent = ($myScore > 0 && $score !== null)
        ? round((($score - $myScore) / $myScore) * 100, 2)
        : 0.0;

    return [
        'usuario_id' => (int) ($user['id'] ?? 0),
        'nome' => (string) ($user['nome'] ?? ''),
        'rp_5k' => isset($user['rp_5k']) ? (int) $user['rp_5k'] : null,
        'rp_10k' => isset($user['rp_10k']) ? (int) $user['rp_10k'] : null,
        'rp_21k' => isset($user['rp_21k']) ? (int) $user['rp_21k'] : null,
        'rp_42k' => isset($user['rp_42k']) ? (int) $user['rp_42k'] : null,
        'rp_5k_formatado' => formatSecondsToRaceTime($user['rp_5k'] ?? null),
        'rp_10k_formatado' => formatSecondsToRaceTime($user['rp_10k'] ?? null),
        'rp_21k_formatado' => formatSecondsToRaceTime($user['rp_21k'] ?? null),
        'rp_42k_formatado' => formatSecondsToRaceTime($user['rp_42k'] ?? null),
        'ritmo_medio_seg_km' => $score,
        'ritmo_medio_formatado' => formatPace($score),
        'diferenca_percentual' => $deltaPercent,
    ];
}

function requireTrainerAuth(): int
{
    $userId = requireAuth();

    ensureUsuariosCompatibilityColumns();
    try {
        $perfil = dbFetchOne('SELECT perfil, email FROM usuarios WHERE id = :id LIMIT 1', [':id' => $userId]);
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao validar perfil de acesso'], 500);
    }

    if (isTrainerOverrideEmail((string) ($perfil['email'] ?? ''))) {
        return $userId;
    }

    $perfilNormalizado = strtolower(trim((string) ($perfil['perfil'] ?? 'aluno')));
    if ($perfilNormalizado !== 'treinador') {
        jsonResponse(['error' => 'Acesso permitido apenas para treinador'], 403);
    }

    return $userId;
}

ensureUsuariosCompatibilityColumns();

if ($method === 'POST' && $path === '/api/auth/cadastro') {
    $input = jsonInput();
    $nome = trim((string) ($input['nome'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $senha = (string) ($input['senha'] ?? '');
    $sexo = strtolower(trim((string) ($input['sexo'] ?? '')));

    if ($nome === '' || $email === '' || $senha === '' || $sexo === '') {
        jsonResponse(['error' => 'Todos os campos são obrigatórios'], 400);
    }

    if (!in_array($sexo, ['masculino', 'feminino'], true)) {
        jsonResponse(['error' => 'Sexo inválido'], 400);
    }

    try {
        dbExecute(
            'INSERT INTO usuarios (nome, email, senha, sexo) VALUES (:nome, :email, :senha, :sexo)',
            [
                ':nome' => $nome,
                ':email' => $email,
                ':senha' => password_hash($senha, PASSWORD_DEFAULT),
                ':sexo' => $sexo,
            ]
        );
        $userId = dbLastInsertId();
    } catch (PDOException $e) {
        if (($e->getCode() ?? '') === '23000') {
            jsonResponse(['error' => 'E-mail já cadastrado'], 400);
        }
        jsonResponse(['error' => 'Erro ao cadastrar usuário'], 500);
    }

    $_SESSION['userId'] = $userId;
    $_SESSION['nome'] = $nome;
    $_SESSION['sexo'] = $sexo;

    jsonResponse([
        'success' => true,
        'message' => 'Cadastro realizado com sucesso!',
        'usuario' => ['id' => $userId, 'nome' => $nome, 'email' => $email, 'sexo' => $sexo],
    ]);
}

if ($method === 'POST' && $path === '/api/auth/login') {
    try {
        $input = jsonInput();
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $senha = (string) ($input['senha'] ?? '');

        if ($email === '' || $senha === '') {
            jsonResponse(['error' => 'E-mail e senha são obrigatórios'], 400);
        }

        $usuario = dbFetchOne('SELECT * FROM usuarios WHERE email = :email LIMIT 1', [':email' => $email]);
        if (!$usuario || !password_verify($senha, (string) ($usuario['senha'] ?? ''))) {
            jsonResponse(['error' => 'E-mail ou senha incorretos'], 401);
        }

        $_SESSION['userId'] = (int) $usuario['id'];
        $_SESSION['nome'] = (string) $usuario['nome'];
        $_SESSION['sexo'] = (string) ($usuario['sexo'] ?? 'masculino');

        jsonResponse([
            'success' => true,
            'message' => 'Login realizado com sucesso!',
            'usuario' => [
                'id' => (int) $usuario['id'],
                'nome' => (string) $usuario['nome'],
                'email' => (string) $usuario['email'],
                'sexo' => (string) ($usuario['sexo'] ?? 'masculino'),
            ],
        ]);
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] Erro no login: ' . $e->getMessage());
        $cfg = appConfig();
        $isDebug = ($cfg['app_env'] ?? 'production') !== 'production';
        $payload = ['error' => 'Erro interno do servidor'];
        if ($isDebug) {
            $payload['debug'] = $e->getMessage();
        }
        jsonResponse($payload, 500);
    }
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logout realizado']);
}

if ($method === 'GET' && $path === '/api/auth/session') {
    $userId = (int) ($_SESSION['userId'] ?? 0);
    if (!$userId) {
        jsonResponse(['authenticated' => false]);
    }

    try {
        $usuario = dbFetchOne(
            'SELECT id, nome, email, altura, sexo, perfil FROM usuarios WHERE id = :id LIMIT 1',
            [':id' => $userId]
        );
    } catch (PDOException) {
        $usuario = dbFetchOne('SELECT id, nome, email FROM usuarios WHERE id = :id LIMIT 1', [':id' => $userId]);
        if ($usuario) {
            $usuario['altura'] = null;
            $usuario['sexo'] = 'masculino';
            $usuario['perfil'] = 'aluno';
        }
    }

    if (!$usuario) {
        jsonResponse(['authenticated' => false]);
    }

    $usuario['altura'] = $usuario['altura'] ?? null;
    $usuario['sexo'] = $usuario['sexo'] ?? 'masculino';
    $usuario['perfil'] = $usuario['perfil'] ?? 'aluno';
    if (isTrainerOverrideEmail((string) ($usuario['email'] ?? ''))) {
        $usuario['perfil'] = 'treinador';
    }
    $usuario['authenticated'] = true;
    jsonResponse($usuario);
}

if ($method === 'POST' && $path === '/api/auth/solicitar-recuperacao') {
    $input = jsonInput();
    $email = strtolower(trim((string) ($input['email'] ?? '')));

    if ($email === '') {
        jsonResponse(['error' => 'E-mail é obrigatório'], 400);
    }

    $usuario = dbFetchOne('SELECT id, nome, email FROM usuarios WHERE email = :email LIMIT 1', [':email' => $email]);
    if (!$usuario) {
        jsonResponse(['error' => 'E-mail não cadastrado'], 404);
    }

    $codigo = (string) random_int(100000, 999999);
    $expiracao = (new DateTimeImmutable('+30 minutes'))->format('Y-m-d H:i:s');

    dbExecute(
        'UPDATE usuarios SET codigo_recuperacao = :codigo, codigo_expiracao = :expiracao WHERE id = :id',
        [':codigo' => $codigo, ':expiracao' => $expiracao, ':id' => (int) $usuario['id']]
    );

    $ok = enviarCodigoRecuperacao((string) $usuario['email'], (string) $usuario['nome'], $codigo);

    if ($ok) {
        jsonResponse(['success' => true, 'message' => 'Código enviado para seu e-mail com sucesso!']);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Código gerado. Verifique o console do servidor.',
        'warning' => 'Serviço de e-mail não configurado',
    ]);
}

if ($method === 'POST' && $path === '/api/auth/redefinir-senha') {
    $input = jsonInput();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $codigo = trim((string) ($input['codigo'] ?? ''));
    $novaSenha = (string) ($input['novaSenha'] ?? '');

    if ($email === '' || $codigo === '' || $novaSenha === '') {
        jsonResponse(['error' => 'Todos os campos são obrigatórios'], 400);
    }

    if (mb_strlen($novaSenha) < 6) {
        jsonResponse(['error' => 'A senha deve ter no mínimo 6 caracteres'], 400);
    }

    $usuario = dbFetchOne(
        'SELECT id, codigo_recuperacao, codigo_expiracao FROM usuarios WHERE email = :email LIMIT 1',
        [':email' => $email]
    );

    if (!$usuario) {
        jsonResponse(['error' => 'E-mail não encontrado'], 404);
    }

    if (empty($usuario['codigo_recuperacao'])) {
        jsonResponse(['error' => 'Nenhum código de recuperação foi solicitado'], 400);
    }

    if ((string) $usuario['codigo_recuperacao'] !== $codigo) {
        jsonResponse(['error' => 'Código inválido'], 400);
    }

    $agora = new DateTimeImmutable('now');
    $expiracao = new DateTimeImmutable((string) $usuario['codigo_expiracao']);
    if ($agora > $expiracao) {
        jsonResponse(['error' => 'Código expirado. Solicite um novo código'], 400);
    }

    dbExecute(
        'UPDATE usuarios SET senha = :senha, codigo_recuperacao = NULL, codigo_expiracao = NULL WHERE id = :id',
        [':senha' => password_hash($novaSenha, PASSWORD_DEFAULT), ':id' => (int) $usuario['id']]
    );

    jsonResponse(['success' => true, 'message' => 'Senha redefinida com sucesso']);
}

if ($method === 'POST' && $path === '/api/pesagens') {
    $usuarioId = requireAuth();
    $input = jsonInput();

    $peso = (float) ($input['peso'] ?? 0);
    if ($peso <= 0) {
        jsonResponse(['error' => 'Peso inválido'], 400);
    }

    $campos = ['usuario_id', 'peso'];
    $placeholders = [':usuario_id', ':peso'];
    $params = [':usuario_id' => $usuarioId, ':peso' => $peso];

    if (!empty($input['data_pesagem'])) {
        $campos[] = 'data_pesagem';
        $placeholders[] = ':data_pesagem';
        $params[':data_pesagem'] = (string) $input['data_pesagem'];
    }

    $bioCampos = [
        'gordura_percentual',
        'massa_muscular_percentual',
        'agua_percentual',
        'massa_ossea',
        'metabolismo_basal',
        'idade_metabolica',
        'gordura_visceral',
    ];

    foreach ($bioCampos as $campo) {
        if (!array_key_exists($campo, $input)) {
            continue;
        }

        $valorRaw = $input[$campo];
        if ($valorRaw === null || $valorRaw === '') {
            continue;
        }

        $campos[] = $campo;
        $placeholders[] = ':' . $campo;
        $params[':' . $campo] = is_numeric($valorRaw) ? (float) $valorRaw : null;
    }

    $sql = sprintf(
        'INSERT INTO pesagens (%s) VALUES (%s)',
        implode(', ', $campos),
        implode(', ', $placeholders)
    );

    dbExecute($sql, $params);
    $id = dbLastInsertId();

    jsonResponse([
        'id' => $id,
        'usuario_id' => $usuarioId,
        'peso' => $peso,
        'message' => 'Pesagem registrada com sucesso!',
    ]);
}

if ($method === 'GET' && $path === '/api/ranking') {
    $usuarioId = requireAuth();

    $perfil = dbFetchOne('SELECT sexo FROM usuarios WHERE id = :id LIMIT 1', [':id' => $usuarioId]);
    if (!$perfil) {
        jsonResponse(['error' => 'Erro ao validar perfil de acesso'], 500);
    }

    if (strtolower((string) ($perfil['sexo'] ?? '')) === 'feminino') {
        jsonResponse([
            'error' => 'Ranking geral indisponível para este perfil',
            'code' => 'RANKING_RESTRITO',
        ], 403);
    }

    try {
        $rows = dbFetchAll(
            'SELECT
                u.id AS usuario_id,
                u.nome,
                (SELECT peso FROM pesagens WHERE usuario_id = u.id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem ASC LIMIT 1) AS peso_inicial,
                (SELECT peso FROM pesagens WHERE usuario_id = u.id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC LIMIT 1) AS peso_atual,
                COUNT(p.id) AS total_pesagens
             FROM usuarios u
             LEFT JOIN pesagens p ON u.id = p.usuario_id AND (p.excluido IS NULL OR p.excluido = 0)
             GROUP BY u.id, u.nome
             HAVING COUNT(p.id) > 0'
        );
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar ranking'], 500);
    }

    $ranking = [];
    foreach ($rows as $row) {
        $pesoInicial = (float) $row['peso_inicial'];
        $pesoAtual = (float) $row['peso_atual'];
        $diferenca = round($pesoAtual - $pesoInicial, 2);
        $percentualPerda = $pesoInicial > 0 ? round((($pesoInicial - $pesoAtual) / $pesoInicial) * 100, 2) : 0.0;

        $row['diferenca'] = $diferenca;
        $row['percentual_perda'] = $percentualPerda;
        $ranking[] = $row;
    }

    usort($ranking, static fn(array $a, array $b): int => ($b['percentual_perda'] <=> $a['percentual_perda']));
    foreach ($ranking as $index => &$item) {
        $item['posicao'] = $index + 1;
    }
    unset($item);

    jsonResponse(['ranking' => $ranking]);
}

if ($method === 'GET' && preg_match('#^/api/pesagens/usuario/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $targetId = (int) $matches[1];

    if ($usuarioId !== $targetId) {
        jsonResponse(['error' => 'Acesso negado'], 403);
    }

    try {
        $pesagens = dbFetchAll(
            'SELECT * FROM pesagens WHERE usuario_id = :usuario_id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC',
            [':usuario_id' => $targetId]
        );
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar histórico'], 500);
    }

    jsonResponse(['pesagens' => $pesagens]);
}

if ($method === 'GET' && $path === '/api/meu-historico') {
    $usuarioId = requireAuth();
    $rows = dbFetchAll(
        'SELECT * FROM pesagens WHERE usuario_id = :usuario_id ORDER BY data_pesagem DESC',
        [':usuario_id' => $usuarioId]
    );
    jsonResponse($rows);
}

if ($method === 'PUT' && $path === '/api/usuarios/altura') {
    $usuarioId = requireAuth();
    $input = jsonInput();
    $altura = (float) ($input['altura'] ?? 0);

    if ($altura <= 0 || $altura > 3) {
        jsonResponse(['error' => 'Altura inválida'], 400);
    }

    dbExecute('UPDATE usuarios SET altura = :altura WHERE id = :id', [':altura' => $altura, ':id' => $usuarioId]);

    jsonResponse([
        'success' => true,
        'message' => 'Altura atualizada com sucesso!',
        'altura' => $altura,
    ]);
}

if ($method === 'GET' && $path === '/api/performance/rps') {
    $usuarioId = requireAuth();

    try {
        $usuario = dbFetchOne(
            'SELECT rp_5k, rp_10k, rp_21k, rp_42k, rp_5k_status, rp_10k_status, rp_21k_status, rp_42k_status FROM usuarios WHERE id = :id LIMIT 1',
            [':id' => $usuarioId]
        );
    } catch (Throwable $e) {
        $usuario = dbFetchOne(
            'SELECT rp_5k, rp_10k, rp_21k, rp_42k FROM usuarios WHERE id = :id LIMIT 1',
            [':id' => $usuarioId]
        );
        if ($usuario) {
            $usuario['rp_5k_status'] = null;
            $usuario['rp_10k_status'] = null;
            $usuario['rp_21k_status'] = null;
            $usuario['rp_42k_status'] = null;
        }
    }

    if (!$usuario) {
        jsonResponse(['error' => 'Usuário não encontrado'], 404);
    }

    $score = calculatePerformanceScore($usuario);

    jsonResponse([
        'rp_5k' => isset($usuario['rp_5k']) ? (int) $usuario['rp_5k'] : null,
        'rp_10k' => isset($usuario['rp_10k']) ? (int) $usuario['rp_10k'] : null,
        'rp_21k' => isset($usuario['rp_21k']) ? (int) $usuario['rp_21k'] : null,
        'rp_42k' => isset($usuario['rp_42k']) ? (int) $usuario['rp_42k'] : null,
        'rp_5k_status' => $usuario['rp_5k_status'] ?? null,
        'rp_10k_status' => $usuario['rp_10k_status'] ?? null,
        'rp_21k_status' => $usuario['rp_21k_status'] ?? null,
        'rp_42k_status' => $usuario['rp_42k_status'] ?? null,
        'rp_5k_formatado' => formatSecondsToRaceTime($usuario['rp_5k'] ?? null),
        'rp_10k_formatado' => formatSecondsToRaceTime($usuario['rp_10k'] ?? null),
        'rp_21k_formatado' => formatSecondsToRaceTime($usuario['rp_21k'] ?? null),
        'rp_42k_formatado' => formatSecondsToRaceTime($usuario['rp_42k'] ?? null),
        'ritmo_medio_seg_km' => $score,
        'ritmo_medio_formatado' => formatPace($score),
    ]);
}

if ($method === 'PUT' && $path === '/api/performance/rps') {
    $usuarioId = requireAuth();
    $input = jsonInput();

    $parsed = [];
    foreach (RACE_COLUMNS as $column) {
        $parsedValue = parseRaceTimeToSeconds($input[$column] ?? null);
        if ($parsedValue === -1) {
            jsonResponse(['error' => 'Formato de tempo inválido para ' . $column], 400);
        }
        $parsed[$column] = $parsedValue;
    }

    $usuarioAtual = dbFetchOne(
        'SELECT rp_5k, rp_10k, rp_21k, rp_42k, rp_5k_status, rp_10k_status, rp_21k_status, rp_42k_status FROM usuarios WHERE id = :id LIMIT 1',
        [':id' => $usuarioId]
    );

    if (!$usuarioAtual) {
        jsonResponse(['error' => 'Usuário não encontrado'], 404);
    }

    $nextStatuses = [];
    foreach (RACE_COLUMNS as $column) {
        $statusColumn = RP_STATUS_COLUMNS[$column];
        $novoValor = $parsed[$column];
        $valorAtual = isset($usuarioAtual[$column]) && $usuarioAtual[$column] !== null
            ? (int) $usuarioAtual[$column]
            : null;
        $statusAtual = $usuarioAtual[$statusColumn] ?? null;

        if ($novoValor === null) {
            $nextStatuses[$statusColumn] = null;
            continue;
        }

        if ($valorAtual === $novoValor && $statusAtual !== null && $statusAtual !== '') {
            $nextStatuses[$statusColumn] = $statusAtual;
            continue;
        }

        $nextStatuses[$statusColumn] = 'pendente';
    }

    dbExecute(
        'UPDATE usuarios
         SET rp_5k = :rp_5k, rp_10k = :rp_10k, rp_21k = :rp_21k, rp_42k = :rp_42k,
             rp_5k_status = :rp_5k_status, rp_10k_status = :rp_10k_status, rp_21k_status = :rp_21k_status, rp_42k_status = :rp_42k_status
         WHERE id = :id',
        [
            ':rp_5k' => $parsed['rp_5k'],
            ':rp_10k' => $parsed['rp_10k'],
            ':rp_21k' => $parsed['rp_21k'],
            ':rp_42k' => $parsed['rp_42k'],
            ':rp_5k_status' => $nextStatuses['rp_5k_status'],
            ':rp_10k_status' => $nextStatuses['rp_10k_status'],
            ':rp_21k_status' => $nextStatuses['rp_21k_status'],
            ':rp_42k_status' => $nextStatuses['rp_42k_status'],
            ':id' => $usuarioId,
        ]
    );

    jsonResponse([
        'success' => true,
        'message' => 'Recordes pessoais atualizados com sucesso!',
        'rps' => [
            'rp_5k' => $parsed['rp_5k'],
            'rp_10k' => $parsed['rp_10k'],
            'rp_21k' => $parsed['rp_21k'],
            'rp_42k' => $parsed['rp_42k'],
            'rp_5k_status' => $nextStatuses['rp_5k_status'],
            'rp_10k_status' => $nextStatuses['rp_10k_status'],
            'rp_21k_status' => $nextStatuses['rp_21k_status'],
            'rp_42k_status' => $nextStatuses['rp_42k_status'],
            'rp_5k_formatado' => formatSecondsToRaceTime($parsed['rp_5k']),
            'rp_10k_formatado' => formatSecondsToRaceTime($parsed['rp_10k']),
            'rp_21k_formatado' => formatSecondsToRaceTime($parsed['rp_21k']),
            'rp_42k_formatado' => formatSecondsToRaceTime($parsed['rp_42k']),
        ],
    ]);
}

if ($method === 'GET' && $path === '/api/performance/grupos') {
    $usuarioId = requireAuth();
    $rows = dbFetchAll('SELECT id, nome, rp_5k, rp_10k, rp_21k, rp_42k FROM usuarios');

    $usuarioLogado = null;
    foreach ($rows as $row) {
        if ((int) ($row['id'] ?? 0) === $usuarioId) {
            $usuarioLogado = $row;
            break;
        }
    }

    if (!$usuarioLogado) {
        jsonResponse(['error' => 'Usuário não encontrado'], 404);
    }

    $meuScore = calculatePerformanceScore($usuarioLogado);
    if ($meuScore === null) {
        jsonResponse([
            'meu_nivel' => null,
            'grupos' => [
                'mesmo_nivel' => [],
                'nivel_mais_alto' => [],
                'nivel_mais_baixo' => [],
            ],
            'aviso' => 'Cadastre ao menos um RP para gerar seus grupos de treino.',
        ]);
    }

    $candidatos = [];
    foreach ($rows as $row) {
        if ((int) ($row['id'] ?? 0) === $usuarioId) {
            continue;
        }
        $score = calculatePerformanceScore($row);
        if ($score === null) {
            continue;
        }
        $candidatos[] = mapRunnerForGroup($row, $meuScore);
    }

    $sameThreshold = 6.0;
    $mesmoNivel = array_values(array_filter($candidatos, static fn($item) => abs((float) ($item['diferenca_percentual'] ?? 0)) <= $sameThreshold));
    usort($mesmoNivel, static fn($a, $b) => abs((float) $a['diferenca_percentual']) <=> abs((float) $b['diferenca_percentual']));

    $nivelMaisAlto = array_values(array_filter($candidatos, static fn($item) => (float) ($item['diferenca_percentual'] ?? 0) < -$sameThreshold));
    usort($nivelMaisAlto, static fn($a, $b) => (float) ($a['ritmo_medio_seg_km'] ?? 999999) <=> (float) ($b['ritmo_medio_seg_km'] ?? 999999));

    $nivelMaisBaixo = array_values(array_filter($candidatos, static fn($item) => (float) ($item['diferenca_percentual'] ?? 0) > $sameThreshold));
    usort($nivelMaisBaixo, static fn($a, $b) => (float) ($a['diferenca_percentual'] ?? 0) <=> (float) ($b['diferenca_percentual'] ?? 0));

    jsonResponse([
        'meu_nivel' => [
            'ritmo_medio_seg_km' => $meuScore,
            'ritmo_medio_formatado' => formatPace($meuScore),
        ],
        'grupos' => [
            'mesmo_nivel' => $mesmoNivel,
            'nivel_mais_alto' => $nivelMaisAlto,
            'nivel_mais_baixo' => $nivelMaisBaixo,
        ],
    ]);
}

if ($method === 'GET' && $path === '/api/treinador/usuarios-ativos') {
    requireTrainerAuth();

    $query = '
        SELECT
          u.id,
          u.nome,
          u.email,
          u.altura,
          u.rp_5k,
          u.rp_10k,
          u.rp_21k,
          u.rp_42k,
          u.rp_5k_status,
          u.rp_10k_status,
          u.rp_21k_status,
          u.rp_42k_status,
          p.peso AS peso_atual,
          p.data_pesagem,
          p.gordura_percentual,
          p.massa_muscular_percentual,
          p.agua_percentual,
          p.massa_ossea,
          p.metabolismo_basal,
          p.idade_metabolica,
          p.gordura_visceral
        FROM usuarios u
        LEFT JOIN pesagens p ON p.id = (
          SELECT p2.id
          FROM pesagens p2
          WHERE p2.usuario_id = u.id AND (p2.excluido IS NULL OR p2.excluido = 0)
          ORDER BY p2.data_pesagem DESC, p2.id DESC
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1
          FROM pesagens p3
          WHERE p3.usuario_id = u.id AND (p3.excluido IS NULL OR p3.excluido = 0)
        )
        ORDER BY u.nome ASC
    ';

    $rows = dbFetchAll($query);

    $usuarios = array_map(static function ($row) {
        $altura = isset($row['altura']) && $row['altura'] !== null ? (float) $row['altura'] : null;
        $pesoAtual = isset($row['peso_atual']) && $row['peso_atual'] !== null ? (float) $row['peso_atual'] : null;
        $imc = ($altura && $pesoAtual && $altura > 0)
            ? round($pesoAtual / ($altura * $altura), 2)
            : null;

        return [
            'usuario_id' => (int) ($row['id'] ?? 0),
            'nome' => (string) ($row['nome'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'altura' => $altura,
            'peso_atual' => $pesoAtual,
            'imc' => $imc,
            'data_pesagem' => $row['data_pesagem'] ?? null,
            'bioimpedancia' => [
                'gordura_percentual' => isset($row['gordura_percentual']) ? (float) $row['gordura_percentual'] : null,
                'massa_muscular_percentual' => isset($row['massa_muscular_percentual']) ? (float) $row['massa_muscular_percentual'] : null,
                'agua_percentual' => isset($row['agua_percentual']) ? (float) $row['agua_percentual'] : null,
                'massa_ossea' => isset($row['massa_ossea']) ? (float) $row['massa_ossea'] : null,
                'metabolismo_basal' => isset($row['metabolismo_basal']) ? (float) $row['metabolismo_basal'] : null,
                'idade_metabolica' => isset($row['idade_metabolica']) ? (float) $row['idade_metabolica'] : null,
                'gordura_visceral' => isset($row['gordura_visceral']) ? (float) $row['gordura_visceral'] : null,
            ],
            'rps' => [
                'rp_5k' => isset($row['rp_5k']) ? (int) $row['rp_5k'] : null,
                'rp_10k' => isset($row['rp_10k']) ? (int) $row['rp_10k'] : null,
                'rp_21k' => isset($row['rp_21k']) ? (int) $row['rp_21k'] : null,
                'rp_42k' => isset($row['rp_42k']) ? (int) $row['rp_42k'] : null,
                'rp_5k_status' => $row['rp_5k_status'] ?? null,
                'rp_10k_status' => $row['rp_10k_status'] ?? null,
                'rp_21k_status' => $row['rp_21k_status'] ?? null,
                'rp_42k_status' => $row['rp_42k_status'] ?? null,
                'rp_5k_formatado' => formatSecondsToRaceTime($row['rp_5k'] ?? null),
                'rp_10k_formatado' => formatSecondsToRaceTime($row['rp_10k'] ?? null),
                'rp_21k_formatado' => formatSecondsToRaceTime($row['rp_21k'] ?? null),
                'rp_42k_formatado' => formatSecondsToRaceTime($row['rp_42k'] ?? null),
            ],
        ];
    }, $rows);

    jsonResponse(['usuarios' => $usuarios]);
}

if ($method === 'PUT' && preg_match('#^/api/treinador/rps/(\d+)/aprovacao$#', $path, $matches) === 1) {
    requireTrainerAuth();

    $alvoUsuarioId = (int) $matches[1];
    $input = jsonInput();
    $prova = strtolower(trim((string) ($input['prova'] ?? '')));
    $status = strtolower(trim((string) ($input['status'] ?? '')));

    if (!in_array($prova, RACE_COLUMNS, true)) {
        jsonResponse(['error' => 'Prova inválida'], 400);
    }

    if (!in_array($status, RP_APPROVAL_STATUSES, true)) {
        jsonResponse(['error' => 'Status inválido'], 400);
    }

    $statusColumn = RP_STATUS_COLUMNS[$prova];

    $usuario = dbFetchOne(
        sprintf('SELECT id, %s AS rp_valor FROM usuarios WHERE id = :id LIMIT 1', $prova),
        [':id' => $alvoUsuarioId]
    );

    if (!$usuario) {
        jsonResponse(['error' => 'Usuário não encontrado'], 404);
    }

    if (!isset($usuario['rp_valor']) || $usuario['rp_valor'] === null || (int) $usuario['rp_valor'] <= 0) {
        jsonResponse(['error' => 'Não é possível aprovar/reprovar sem RP cadastrado'], 400);
    }

    dbExecute(
        sprintf('UPDATE usuarios SET %s = :status WHERE id = :id', $statusColumn),
        [':status' => $status, ':id' => $alvoUsuarioId]
    );

    jsonResponse([
        'success' => true,
        'message' => sprintf('Status %s atualizado para %s', $prova, $status),
    ]);
}

if ($method === 'GET' && $path === '/api/estatisticas') {
    try {
        $totalUsuarios = (int) (dbFetchOne('SELECT COUNT(*) AS c FROM usuarios')['c'] ?? 0);
        $totalPesagens = (int) (dbFetchOne('SELECT COUNT(*) AS c FROM pesagens WHERE excluido IS NULL OR excluido = 0')['c'] ?? 0);
        $pesoMedio = (float) (dbFetchOne('SELECT AVG(peso) AS media FROM pesagens WHERE excluido IS NULL OR excluido = 0')['media'] ?? 0);

        $usuariosComPesagem = dbFetchAll(
            'SELECT DISTINCT usuario_id FROM pesagens WHERE excluido IS NULL OR excluido = 0'
        );

        $perdaTotal = 0.0;
        foreach ($usuariosComPesagem as $row) {
            $uid = (int) ($row['usuario_id'] ?? 0);
            if ($uid <= 0) {
                continue;
            }

            $pesoInicial = dbFetchOne(
                'SELECT peso FROM pesagens WHERE usuario_id = :uid AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem ASC LIMIT 1',
                [':uid' => $uid]
            );
            $pesoAtual = dbFetchOne(
                'SELECT peso FROM pesagens WHERE usuario_id = :uid AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC LIMIT 1',
                [':uid' => $uid]
            );

            if ($pesoInicial && $pesoAtual) {
                $perdaTotal += ((float) $pesoInicial['peso'] - (float) $pesoAtual['peso']);
            }
        }

        jsonResponse([
            'total_usuarios' => $totalUsuarios,
            'total_pesagens' => $totalPesagens,
            'peso_medio_geral' => round($pesoMedio, 2),
            'perda_total_kg' => round($perdaTotal, 2),
        ]);
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar estatísticas'], 500);
    }
}

if ($method === 'PUT' && preg_match('#^/api/pesagens/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $pesagemId = (int) $matches[1];
    $input = jsonInput();
    $peso = (float) ($input['peso'] ?? 0);

    if ($peso <= 0) {
        jsonResponse(['error' => 'Peso inválido'], 400);
    }

    $pesagem = dbFetchOne(
        'SELECT id FROM pesagens WHERE id = :id AND usuario_id = :usuario_id LIMIT 1',
        [':id' => $pesagemId, ':usuario_id' => $usuarioId]
    );

    if (!$pesagem) {
        jsonResponse(['error' => 'Pesagem não encontrada ou não pertence a você'], 404);
    }

    dbExecute('UPDATE pesagens SET peso = :peso WHERE id = :id', [':peso' => $peso, ':id' => $pesagemId]);
    jsonResponse(['success' => true, 'message' => 'Pesagem atualizada com sucesso']);
}

if ($method === 'DELETE' && preg_match('#^/api/pesagens/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $pesagemId = (int) $matches[1];

    $pesagem = dbFetchOne(
        'SELECT id FROM pesagens WHERE id = :id AND usuario_id = :usuario_id LIMIT 1',
        [':id' => $pesagemId, ':usuario_id' => $usuarioId]
    );

    if (!$pesagem) {
        jsonResponse(['error' => 'Pesagem não encontrada ou não pertence a você'], 404);
    }

    dbExecute('UPDATE pesagens SET excluido = 1 WHERE id = :id', [':id' => $pesagemId]);
    jsonResponse(['success' => true, 'message' => 'Pesagem excluída com sucesso']);
}

if ($method === 'POST' && preg_match('#^/api/pesagens/(\d+)/restaurar$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $pesagemId = (int) $matches[1];

    $pesagem = dbFetchOne(
        'SELECT id FROM pesagens WHERE id = :id AND usuario_id = :usuario_id LIMIT 1',
        [':id' => $pesagemId, ':usuario_id' => $usuarioId]
    );

    if (!$pesagem) {
        jsonResponse(['error' => 'Pesagem não encontrada ou não pertence a você'], 404);
    }

    dbExecute('UPDATE pesagens SET excluido = 0 WHERE id = :id', [':id' => $pesagemId]);
    jsonResponse(['success' => true, 'message' => 'Pesagem restaurada com sucesso']);
}

if ($method === 'GET' && preg_match('#^/api/pesagens/excluidas/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $targetId = (int) $matches[1];

    if ($usuarioId !== $targetId) {
        jsonResponse(['error' => 'Acesso negado'], 403);
    }

    $pesagens = dbFetchAll(
        'SELECT * FROM pesagens WHERE usuario_id = :usuario_id AND excluido = 1 ORDER BY data_pesagem DESC',
        [':usuario_id' => $targetId]
    );

    jsonResponse(['pesagens' => $pesagens]);
}

$pages = [
    '/login' => 'login.html',
    '/cadastro' => 'cadastro.html',
    '/recuperar-senha' => 'recuperar-senha.html',
    '/home' => 'home.html',
    '/pesagem' => 'pesagem.html',
    '/ranking' => 'ranking.html',
    '/bioimpedancia' => 'bioimpedancia.html',
    '/grupos-treino' => 'grupos-treino.html',
    '/treinador' => 'treinador.html',
];

if ($path === '/' || $path === '') {
    if (empty($_SESSION['userId'])) {
        redirectTo('/login');
    }
    redirectTo('/home');
}

if (array_key_exists($path, $pages)) {
    $protectedPages = ['/home', '/pesagem', '/ranking', '/bioimpedancia', '/grupos-treino', '/treinador'];
    if (in_array($path, $protectedPages, true) && empty($_SESSION['userId'])) {
        redirectTo('/login');
    }
    sendHtml($pages[$path]);
}

if (str_starts_with($path, '/api/')) {
    jsonResponse(['error' => 'Rota de API não encontrada'], 404);
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Rota não encontrada';
