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
    $isDevPath = str_starts_with($uriPath, '/dev/');
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $isApi = str_contains($uriPath, '/api/');

    error_log('[AgeRun PHP] Unhandled exception: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());

    if ($isApi || str_contains($accept, 'application/json')) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        $payload = ['error' => 'Erro interno do servidor'];
        if ($isDebug || $isDevPath) {
            $payload['debug'] = $e->getMessage();
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return;
    }

    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo ($isDebug || $isDevPath) ? ('Erro interno do servidor: ' . $e->getMessage()) : 'Erro interno do servidor';
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
    'filipe.sul@gmail.com',
];
const MONITOR_OWNER_EMAIL = 'moisescamposdelfino@gmail.com';

function isTrainerOverrideEmail(?string $email): bool
{
    $normalized = strtolower(trim((string) $email));
    if ($normalized === '') {
        return false;
    }

    return in_array($normalized, TRAINER_OVERRIDE_EMAILS, true);
}

function isHiddenFromRankingEmail(?string $email): bool
{
    $normalized = strtolower(trim((string) $email));
    if ($normalized === '') {
        return false;
    }

    // Contas de teste com este domínio não aparecem no ranking.
    return str_ends_with($normalized, '@teste.local');
}

function normalizeEmail(string $email): string
{
    return strtolower(trim($email));
}

function isMonitorOwnerEmail(?string $email): bool
{
    return normalizeEmail((string) $email) === MONITOR_OWNER_EMAIL;
}

function monitorEventsFilePath(): string
{
    return dirname(__DIR__) . '/storage/monitor_events.jsonl';
}

function monitorPwaStatusFilePath(): string
{
    return dirname(__DIR__) . '/storage/monitor_pwa_status.json';
}

function appendMonitorEvent(array $event): void
{
    $path = monitorEventsFilePath();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $payload = [
        'ts_unix' => time(),
        'ts_iso' => gmdate('c'),
    ] + $event;

    @file_put_contents(
        $path,
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

function loadMonitorPwaStatuses(): array
{
    $path = monitorPwaStatusFilePath();
    if (!is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function saveMonitorPwaStatuses(array $items): void
{
    $path = monitorPwaStatusFilePath();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    @file_put_contents(
        $path,
        json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function upsertMonitorPwaStatus(array $snapshot, array $status): bool
{
    $userId = (int) ($snapshot['id'] ?? 0);
    if ($userId <= 0) {
        return false;
    }

    $items = loadMonitorPwaStatuses();
    $index = null;
    foreach ($items as $i => $item) {
        if ((int) ($item['user_id'] ?? 0) === $userId) {
            $index = $i;
            break;
        }
    }

    $existing = $index === null ? [] : (array) ($items[$index] ?? []);
    $wasInstalled = (int) ($existing['installed_at_unix'] ?? 0) > 0;
    $now = time();
    $isInstalledNow = !empty($status['installed']);

    $merged = [
        'user_id' => $userId,
        'user_nome' => (string) ($snapshot['nome'] ?? ''),
        'user_email' => normalizeEmail((string) ($snapshot['email'] ?? '')),
        'last_source' => (string) ($status['source'] ?? 'heartbeat'),
        'last_platform' => (string) ($status['platform'] ?? 'mobile'),
        'last_user_agent' => (string) ($status['user_agent'] ?? ''),
        'last_seen_unix' => $now,
        'last_seen_iso' => gmdate('c', $now),
        'installed_at_unix' => (int) ($existing['installed_at_unix'] ?? 0),
        'installed_at_iso' => (string) ($existing['installed_at_iso'] ?? ''),
        'install_detected_by' => (string) ($existing['install_detected_by'] ?? ''),
    ];

    if ($isInstalledNow && !$wasInstalled) {
        $merged['installed_at_unix'] = $now;
        $merged['installed_at_iso'] = gmdate('c', $now);
        $merged['install_detected_by'] = (string) ($status['source'] ?? 'heartbeat');
    }

    if ($isInstalledNow && $wasInstalled && $merged['install_detected_by'] === '') {
        $merged['install_detected_by'] = (string) ($status['source'] ?? 'heartbeat');
    }

    if ($index === null) {
        $items[] = $merged;
    } else {
        $items[$index] = $merged;
    }

    saveMonitorPwaStatuses($items);

    return $isInstalledNow && !$wasInstalled;
}

function getMonitorInstalledUsers(): array
{
    $items = loadMonitorPwaStatuses();
    $installed = array_values(array_filter($items, static function ($item) {
        return (int) ($item['installed_at_unix'] ?? 0) > 0;
    }));

    usort($installed, static function ($a, $b) {
        return (int) ($b['installed_at_unix'] ?? 0) <=> (int) ($a['installed_at_unix'] ?? 0);
    });

    return $installed;
}

function getUserSnapshotById(int $userId): ?array
{
    if ($userId <= 0) {
        return null;
    }

    if ((int) ($_SESSION['userId'] ?? 0) === $userId && !empty($_SESSION['email'])) {
        return [
            'id' => $userId,
            'nome' => (string) ($_SESSION['nome'] ?? ''),
            'email' => (string) ($_SESSION['email'] ?? ''),
            'perfil' => (string) ($_SESSION['perfil'] ?? 'aluno'),
        ];
    }

    try {
        try {
            $row = dbFetchOne(
                'SELECT id, nome, email, perfil FROM usuarios WHERE id = :id LIMIT 1',
                [':id' => $userId]
            );
        } catch (Throwable) {
            $row = dbFetchOne(
                'SELECT id, nome, email FROM usuarios WHERE id = :id LIMIT 1',
                [':id' => $userId]
            );
            if ($row) {
                $row['perfil'] = 'aluno';
            }
        }
    } catch (Throwable) {
        return null;
    }

    if (!$row) {
        return null;
    }

    $snapshot = [
        'id' => (int) ($row['id'] ?? 0),
        'nome' => (string) ($row['nome'] ?? ''),
        'email' => (string) ($row['email'] ?? ''),
        'perfil' => (string) ($row['perfil'] ?? 'aluno'),
    ];

    if ((int) ($_SESSION['userId'] ?? 0) === $snapshot['id']) {
        $_SESSION['nome'] = $snapshot['nome'];
        $_SESSION['email'] = $snapshot['email'];
        $_SESSION['perfil'] = $snapshot['perfil'];
    }

    return $snapshot;
}

function isAlunoSnapshot(array $snapshot): bool
{
    $email = (string) ($snapshot['email'] ?? '');
    if (isTrainerOverrideEmail($email)) {
        return false;
    }

    $perfil = strtolower(trim((string) ($snapshot['perfil'] ?? 'aluno')));
    return $perfil !== 'treinador';
}

function currentClientIp(): string
{
    $xff = trim((string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($xff !== '') {
        $parts = explode(',', $xff);
        return trim((string) ($parts[0] ?? ''));
    }

    return trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
}

function trackAlunoApiActivity(string $method, string $path): void
{
    if (!str_starts_with($path, '/api/')) {
        return;
    }

    if ($path === '/api/auth/session' || str_starts_with($path, '/api/admin/monitoramento') || str_starts_with($path, '/api/monitoramento/pwa-status')) {
        return;
    }

    $userId = (int) ($_SESSION['userId'] ?? 0);
    if ($userId <= 0) {
        return;
    }

    $snapshot = getUserSnapshotById($userId);
    if (!$snapshot || !isAlunoSnapshot($snapshot)) {
        return;
    }

    appendMonitorEvent([
        'event_type' => 'api_action',
        'method' => strtoupper($method),
        'path' => $path,
        'user_id' => (int) ($snapshot['id'] ?? 0),
        'user_nome' => (string) ($snapshot['nome'] ?? ''),
        'user_email' => normalizeEmail((string) ($snapshot['email'] ?? '')),
        'ip' => currentClientIp(),
    ]);
}

function trackAlunoPageAccess(string $path): void
{
    $userId = (int) ($_SESSION['userId'] ?? 0);
    if ($userId <= 0) {
        return;
    }

    $snapshot = getUserSnapshotById($userId);
    if (!$snapshot || !isAlunoSnapshot($snapshot)) {
        return;
    }

    appendMonitorEvent([
        'event_type' => 'page_access',
        'method' => 'GET',
        'path' => $path,
        'user_id' => (int) ($snapshot['id'] ?? 0),
        'user_nome' => (string) ($snapshot['nome'] ?? ''),
        'user_email' => normalizeEmail((string) ($snapshot['email'] ?? '')),
        'ip' => currentClientIp(),
    ]);
}

function readMonitorEvents(int $limit = 100, int $sinceUnix = 0): array
{
    $path = monitorEventsFilePath();
    if (!is_file($path)) {
        return [];
    }

    $rows = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($rows) || !$rows) {
        return [];
    }

    $events = [];
    for ($i = count($rows) - 1; $i >= 0; $i--) {
        $decoded = json_decode((string) $rows[$i], true);
        if (!is_array($decoded)) {
            continue;
        }

        $ts = (int) ($decoded['ts_unix'] ?? 0);
        if ($sinceUnix > 0 && $ts < $sinceUnix) {
            continue;
        }

        $events[] = $decoded;
        if (count($events) >= $limit) {
            break;
        }
    }

    return array_reverse($events);
}

function requireMonitorOwnerAuth(): int
{
    $userId = requireAuth();
    $snapshot = getUserSnapshotById($userId);

    if (!$snapshot || !isMonitorOwnerEmail((string) ($snapshot['email'] ?? ''))) {
        jsonResponse(['error' => 'Acesso restrito ao administrador do monitoramento'], 403);
    }

    return $userId;
}

function sessionRequiresPasswordChange(): bool
{
    return !empty($_SESSION['requirePasswordChange']);
}

function generateTemporaryPassword(int $length = 10): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#';
    $maxIndex = strlen($alphabet) - 1;
    if ($maxIndex < 1) {
        return 'Temp#1234';
    }

    $password = '';
    for ($i = 0; $i < $length; $i++) {
        $password .= $alphabet[random_int(0, $maxIndex)];
    }

    return $password;
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

function safeDbColumnExists(string $table, string $column): bool
{
    try {
        return dbColumnExists($table, $column);
    } catch (Throwable $e) {
        return false;
    }
}

function defaultValueForSqlType(string $type, string $timestampValue): mixed
{
    $normalized = strtolower($type);

    if (
        str_contains($normalized, 'int')
        || str_contains($normalized, 'real')
        || str_contains($normalized, 'double')
        || str_contains($normalized, 'float')
        || str_contains($normalized, 'decimal')
        || str_contains($normalized, 'numeric')
    ) {
        return 0;
    }

    if (str_contains($normalized, 'date') || str_contains($normalized, 'time')) {
        return $timestampValue;
    }

    return '';
}

function tryInsertRpTesteHistoricoByMetadata(array $baseValues): ?int
{
    $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));
    $table = 'rp_testes_historico';
    $columnsMeta = [];

    if ($driver === 'sqlite') {
        $rows = dbFetchAll("PRAGMA table_info({$table})");
        foreach ($rows as $row) {
            $name = (string) ($row['name'] ?? '');
            if ($name === '') {
                continue;
            }

            $isPk = (int) ($row['pk'] ?? 0) === 1;
            $hasDefault = array_key_exists('dflt_value', $row) && $row['dflt_value'] !== null;
            $columnsMeta[] = [
                'name' => $name,
                'type' => (string) ($row['type'] ?? ''),
                'required' => ((int) ($row['notnull'] ?? 0) === 1) && !$hasDefault && !$isPk,
                'auto' => $isPk,
            ];
        }
    } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
        $rows = dbFetchAll(
            'SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
              WHERE table_name = :table
              ORDER BY ordinal_position',
            [':table' => $table]
        );

        foreach ($rows as $row) {
            $name = (string) ($row['column_name'] ?? '');
            if ($name === '') {
                continue;
            }

            $defaultExpr = strtolower((string) ($row['column_default'] ?? ''));
            $isAuto = str_contains($defaultExpr, 'nextval(') || str_contains($defaultExpr, 'generated');
            $columnsMeta[] = [
                'name' => $name,
                'type' => (string) ($row['data_type'] ?? ''),
                'required' => strtoupper((string) ($row['is_nullable'] ?? 'YES')) === 'NO' && $defaultExpr === '' && !$isAuto,
                'auto' => $isAuto,
            ];
        }
    } else {
        $rows = dbFetchAll("SHOW COLUMNS FROM {$table}");
        foreach ($rows as $row) {
            $name = (string) ($row['Field'] ?? '');
            if ($name === '') {
                continue;
            }

            $extra = strtolower((string) ($row['Extra'] ?? ''));
            $isAuto = str_contains($extra, 'auto_increment');
            $hasDefault = array_key_exists('Default', $row) && $row['Default'] !== null;
            $columnsMeta[] = [
                'name' => $name,
                'type' => (string) ($row['Type'] ?? ''),
                'required' => strtoupper((string) ($row['Null'] ?? 'YES')) !== 'YES' && !$hasDefault && !$isAuto,
                'auto' => $isAuto,
            ];
        }
    }

    if (!$columnsMeta) {
        throw new RuntimeException('Tabela rp_testes_historico sem metadados de colunas');
    }

    $timestampValue = date('Y-m-d H:i:s');
    $values = [];

    foreach ($columnsMeta as $meta) {
        $name = strtolower((string) ($meta['name'] ?? ''));
        if ($name === '' || !empty($meta['auto'])) {
            continue;
        }

        if (array_key_exists($name, $baseValues)) {
            $values[$name] = $baseValues[$name];
            continue;
        }

        if (in_array($name, ['criado_em', 'created_at', 'updated_at', 'data_teste', 'data_criacao', 'data'], true)) {
            $values[$name] = $timestampValue;
            continue;
        }

        if (!empty($meta['required'])) {
            $values[$name] = defaultValueForSqlType((string) ($meta['type'] ?? ''), $timestampValue);
        }
    }

    if (!$values) {
        throw new RuntimeException('Sem colunas elegíveis para insert em rp_testes_historico');
    }

    $columns = array_keys($values);
    $placeholders = array_map(static fn ($column) => ':' . $column, $columns);
    $params = [];
    foreach ($columns as $column) {
        $params[':' . $column] = $values[$column];
    }

    dbExecute(
        'INSERT INTO rp_testes_historico (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')',
        $params
    );

    try {
        $lastInsertId = dbLastInsertId();
        return $lastInsertId > 0 ? $lastInsertId : null;
    } catch (Throwable $e) {
        return null;
    }
}

function fallbackTestsFilePath(): string
{
    return dirname(__DIR__) . '/storage/rp_testes_fallback.json';
}

function loadFallbackTests(): array
{
    $path = fallbackTestsFilePath();

    if (!is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function deletedTestsFilePath(): string
{
    return dirname(__DIR__) . '/storage/rp_testes_deleted.json';
}

function editedTestsFilePath(): string
{
    return dirname(__DIR__) . '/storage/rp_testes_edited.json';
}

function loadDeletedTestsList(): array
{
    $path = deletedTestsFilePath();
    if (!is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function loadEditedTestsList(): array
{
    $path = editedTestsFilePath();
    if (!is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function saveFallbackTests(array $items): void
{
    $path = fallbackTestsFilePath();

    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    @file_put_contents(
        $path,
        json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function saveDeletedTestsList(array $items): void
{
    $path = deletedTestsFilePath();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    @file_put_contents(
        $path,
        json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function saveEditedTestsList(array $items): void
{
    $path = editedTestsFilePath();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    @file_put_contents(
        $path,
        json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function getEditedTestOverride(int $usuarioId, int $testeId): ?array
{
    if ($usuarioId <= 0 || $testeId <= 0) {
        return null;
    }

    foreach (loadEditedTestsList() as $item) {
        if ((int) ($item['usuario_id'] ?? 0) === $usuarioId && (int) ($item['id'] ?? 0) === $testeId) {
            return is_array($item) ? $item : null;
        }
    }

    return null;
}

function upsertEditedTestOverride(int $usuarioId, int $testeId, int $tempoSegundos, float $distanciaKm, float $paceSegundosKm): void
{
    if ($usuarioId <= 0 || $testeId <= 0) {
        return;
    }

    $items = loadEditedTestsList();
    $updated = false;

    foreach ($items as &$item) {
        if ((int) ($item['usuario_id'] ?? 0) === $usuarioId && (int) ($item['id'] ?? 0) === $testeId) {
            $item['tempo_segundos'] = $tempoSegundos;
            $item['distancia_km'] = $distanciaKm;
            $item['pace_segundos_km'] = $paceSegundosKm;
            $item['updated_at'] = date('Y-m-d H:i:s');
            $updated = true;
            break;
        }
    }
    unset($item);

    if (!$updated) {
        $items[] = [
            'usuario_id' => $usuarioId,
            'id' => $testeId,
            'tempo_segundos' => $tempoSegundos,
            'distancia_km' => $distanciaKm,
            'pace_segundos_km' => $paceSegundosKm,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
    }

    saveEditedTestsList($items);
}

function clearEditedTestOverride(int $usuarioId, int $testeId): void
{
    if ($usuarioId <= 0 || $testeId <= 0) {
        return;
    }

    $items = array_values(array_filter(loadEditedTestsList(), static function ($item) use ($usuarioId, $testeId) {
        return !((int) ($item['usuario_id'] ?? 0) === $usuarioId && (int) ($item['id'] ?? 0) === $testeId);
    }));

    saveEditedTestsList($items);
}

function appendFallbackTeste(array $payload): int
{
    $items = loadFallbackTests();
    $maxId = 0;
    foreach ($items as $item) {
        $maxId = max($maxId, (int) ($item['id'] ?? 0));
    }

    $nextId = $maxId + 1;
    $payload['id'] = $nextId;
    $items[] = $payload;
    saveFallbackTests($items);

    return $nextId;
}

function insertRpTesteHistoricoCompat(
    int $alvoUsuarioId,
    int $treinadorId,
    int $tempoSegundos,
    float $distanciaKm,
    float $paceSegundosKm
): ?int {
    $baseValues = [
        'usuario_id' => $alvoUsuarioId,
        'treinador_id' => $treinadorId,
        'prova' => 'teste',
        'tempo_segundos' => $tempoSegundos,
        'distancia_km' => $distanciaKm,
        'pace_segundos_km' => $paceSegundosKm,
    ];

    $candidates = [
        ['usuario_id', 'treinador_id', 'prova', 'tempo_segundos', 'distancia_km', 'pace_segundos_km'],
        ['usuario_id', 'treinador_id', 'tempo_segundos', 'distancia_km', 'pace_segundos_km'],
        ['usuario_id', 'treinador_id', 'prova', 'tempo_segundos', 'distancia_km'],
        ['usuario_id', 'treinador_id', 'prova', 'tempo_segundos', 'pace_segundos_km'],
        ['usuario_id', 'treinador_id', 'tempo_segundos', 'distancia_km'],
        ['usuario_id', 'treinador_id', 'tempo_segundos', 'pace_segundos_km'],
        ['usuario_id', 'treinador_id', 'tempo_segundos'],
    ];

    $lastError = null;
    $attemptErrors = [];

    $attemptInsert = static function (array $columns) use ($baseValues): void {
        $placeholders = array_map(static fn ($column) => ':' . $column, $columns);
        $params = [];
        foreach ($columns as $column) {
            $params[':' . $column] = $baseValues[$column];
        }

        dbExecute(
            'INSERT INTO rp_testes_historico (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')',
            $params
        );
    };

    $ensureRetried = false;

    foreach ($candidates as $columns) {
        try {
            $attemptInsert($columns);
            try {
                $lastInsertId = dbLastInsertId();
                return $lastInsertId > 0 ? $lastInsertId : null;
            } catch (Throwable $e) {
                // Em alguns bancos/instalacoes o lastInsertId pode não estar disponível.
                return null;
            }
        } catch (Throwable $e) {
            $lastError = $e;
            $message = strtolower($e->getMessage());
            $attemptErrors[] = sprintf('[%s] %s', implode(',', $columns), $e->getMessage());

            if (!$ensureRetried && (
                str_contains($message, 'no such table')
                || str_contains($message, "doesn't exist")
                || str_contains($message, 'does not exist')
            )) {
                $ensureRetried = true;
                ensureRpTestesTable();
            }
        }
    }

    if ($attemptErrors) {
        error_log('[AgeRun PHP] Tentativas insert rp_testes_historico: ' . implode(' || ', $attemptErrors));
    }

    try {
        return tryInsertRpTesteHistoricoByMetadata($baseValues);
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] Fallback metadata insert falhou: ' . $e->getMessage());
    }

    $fallbackId = appendFallbackTeste([
        'usuario_id' => $alvoUsuarioId,
        'treinador_id' => $treinadorId,
        'prova' => 'teste',
        'tempo_segundos' => $tempoSegundos,
        'distancia_km' => $distanciaKm,
        'pace_segundos_km' => $paceSegundosKm,
        'criado_em' => date('Y-m-d H:i:s'),
        'treinador_nome' => null,
        'source' => 'file-fallback',
    ]);
    return $fallbackId;
}

function isTestSoftDeleted(int $usuarioId, int $testeId): bool
{
    if ($usuarioId <= 0 || $testeId <= 0) {
        return false;
    }

    foreach (loadDeletedTestsList() as $item) {
        if ((int) ($item['usuario_id'] ?? 0) === $usuarioId && (int) ($item['id'] ?? 0) === $testeId) {
            return true;
        }
    }

    return false;
}

function markTestSoftDeleted(int $usuarioId, int $testeId): void
{
    if ($usuarioId <= 0 || $testeId <= 0) {
        return;
    }

    $items = loadDeletedTestsList();
    foreach ($items as $item) {
        if ((int) ($item['usuario_id'] ?? 0) === $usuarioId && (int) ($item['id'] ?? 0) === $testeId) {
            return;
        }
    }

    $items[] = [
        'usuario_id' => $usuarioId,
        'id' => $testeId,
        'deleted_at' => date('Y-m-d H:i:s'),
    ];
    saveDeletedTestsList($items);
}

function unmarkTestSoftDeleted(int $usuarioId, int $testeId): void
{
    if ($usuarioId <= 0 || $testeId <= 0) {
        return;
    }

    $items = array_values(array_filter(loadDeletedTestsList(), static function ($item) use ($usuarioId, $testeId) {
        return !((int) ($item['usuario_id'] ?? 0) === $usuarioId && (int) ($item['id'] ?? 0) === $testeId);
    }));

    saveDeletedTestsList($items);
}

function ensureUsuariosCompatibilityColumns(): void
{
    try {
        $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

        $missing = [];
        $targetColumns = [
            'perfil' => "VARCHAR(20) DEFAULT 'aluno'",
            'senha_temporaria' => 'INTEGER DEFAULT 0',
            'email_verificado' => 'INTEGER DEFAULT 1',
            'email_verificacao_token' => 'VARCHAR(120) DEFAULT NULL',
            'email_verificacao_expiracao' => 'DATETIME DEFAULT NULL',
            'rp_5k' => 'INTEGER DEFAULT NULL',
            'rp_10k' => 'INTEGER DEFAULT NULL',
            'rp_21k' => 'INTEGER DEFAULT NULL',
            'rp_42k' => 'INTEGER DEFAULT NULL',
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

        try {
            dbExecute("UPDATE usuarios SET email_verificado = 1 WHERE email_verificado IS NULL OR (email_verificado = 0 AND (email_verificacao_token IS NULL OR TRIM(email_verificacao_token) = ''))");
        } catch (Throwable $e) {
            // Ignorar em caso de ambientes sem coluna ainda visível.
        }
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] ensureUsuariosCompatibilityColumns ignorado: ' . $e->getMessage());
    }
}

function ensureCoreTables(): void
{
    try {
        $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

        if ($driver === 'sqlite') {
            dbExecute(
                'CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    senha TEXT NOT NULL,
                    sexo TEXT DEFAULT "masculino",
                    altura REAL NULL,
                    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    senha_temporaria INTEGER DEFAULT 0,
                    email_verificado INTEGER DEFAULT 1,
                    email_verificacao_token TEXT NULL,
                    email_verificacao_expiracao DATETIME NULL,
                    codigo_recuperacao TEXT NULL,
                    codigo_expiracao DATETIME NULL
                )'
            );

            dbExecute(
                'CREATE TABLE IF NOT EXISTS pesagens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER NOT NULL,
                    peso REAL NOT NULL,
                    gordura_percentual REAL NULL,
                    massa_muscular_percentual REAL NULL,
                    agua_percentual REAL NULL,
                    massa_ossea REAL NULL,
                    metabolismo_basal INTEGER NULL,
                    idade_metabolica INTEGER NULL,
                    gordura_visceral INTEGER NULL,
                    data_pesagem DATETIME DEFAULT CURRENT_TIMESTAMP,
                    excluido INTEGER DEFAULT 0
                )'
            );

            dbExecute('CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)');
            dbExecute('CREATE INDEX IF NOT EXISTS idx_pesagens_usuario_id ON pesagens(usuario_id)');
            return;
        }

        if ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
            dbExecute(
                'CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    nome TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    senha TEXT NOT NULL,
                    sexo TEXT DEFAULT \'masculino\',
                    altura DOUBLE PRECISION NULL,
                    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    senha_temporaria INTEGER DEFAULT 0,
                    email_verificado INTEGER DEFAULT 1,
                    email_verificacao_token TEXT NULL,
                    email_verificacao_expiracao TIMESTAMP NULL,
                    codigo_recuperacao TEXT NULL,
                    codigo_expiracao TIMESTAMP NULL
                )'
            );

            dbExecute(
                'CREATE TABLE IF NOT EXISTS pesagens (
                    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    peso DOUBLE PRECISION NOT NULL,
                    gordura_percentual DOUBLE PRECISION NULL,
                    massa_muscular_percentual DOUBLE PRECISION NULL,
                    agua_percentual DOUBLE PRECISION NULL,
                    massa_ossea DOUBLE PRECISION NULL,
                    metabolismo_basal INTEGER NULL,
                    idade_metabolica INTEGER NULL,
                    gordura_visceral INTEGER NULL,
                    data_pesagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    excluido INTEGER DEFAULT 0
                )'
            );

            dbExecute('CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)');
            dbExecute('CREATE INDEX IF NOT EXISTS idx_pesagens_usuario_id ON pesagens(usuario_id)');
            return;
        }

        dbExecute(
            'CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                senha VARCHAR(255) NOT NULL,
                sexo VARCHAR(20) DEFAULT \'masculino\',
                altura DECIMAL(4,2) NULL,
                data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                senha_temporaria TINYINT(1) DEFAULT 0,
                email_verificado TINYINT(1) DEFAULT 1,
                email_verificacao_token VARCHAR(120) NULL,
                email_verificacao_expiracao DATETIME NULL,
                codigo_recuperacao VARCHAR(20) NULL,
                codigo_expiracao DATETIME NULL
            )'
        );

        dbExecute(
            'CREATE TABLE IF NOT EXISTS pesagens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                peso DECIMAL(6,2) NOT NULL,
                gordura_percentual DECIMAL(5,2) NULL,
                massa_muscular_percentual DECIMAL(5,2) NULL,
                agua_percentual DECIMAL(5,2) NULL,
                massa_ossea DECIMAL(5,2) NULL,
                metabolismo_basal INT NULL,
                idade_metabolica INT NULL,
                gordura_visceral INT NULL,
                data_pesagem DATETIME DEFAULT CURRENT_TIMESTAMP,
                excluido TINYINT(1) DEFAULT 0,
                CONSTRAINT fk_pesagens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )'
        );

        try {
            dbExecute('CREATE INDEX idx_usuarios_email ON usuarios(email)');
        } catch (Throwable $e) {
            // Indice ja existe.
        }

        try {
            dbExecute('CREATE INDEX idx_pesagens_usuario_id ON pesagens(usuario_id)');
        } catch (Throwable $e) {
            // Indice ja existe.
        }
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] ensureCoreTables ignorado: ' . $e->getMessage());
    }
}

function generateEmailVerificationToken(): string
{
    return bin2hex(random_bytes(24));
}

function buildVerificationRedirectPath(string $status, string $email = ''): string
{
    $query = ['email_confirmacao' => $status];
    if ($email !== '') {
        $query['email'] = $email;
    }

    return '/login?' . http_build_query($query);
}

function ensureRpTestesTable(): void
{
    try {
        $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

        if ($driver === 'sqlite') {
            dbExecute(
                'CREATE TABLE IF NOT EXISTS rp_testes_historico (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER NOT NULL,
                    treinador_id INTEGER NOT NULL,
                    prova TEXT NULL,
                    tempo_segundos INTEGER NOT NULL,
                    distancia_km REAL NOT NULL,
                    pace_segundos_km REAL NOT NULL,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                )'
            );
            if (!dbColumnExists('rp_testes_historico', 'prova')) {
                dbExecute('ALTER TABLE rp_testes_historico ADD COLUMN prova TEXT');
            }
            if (!dbColumnExists('rp_testes_historico', 'distancia_km')) {
                dbExecute('ALTER TABLE rp_testes_historico ADD COLUMN distancia_km REAL');
            }
            dbExecute('CREATE INDEX IF NOT EXISTS idx_rp_testes_usuario_data ON rp_testes_historico(usuario_id, criado_em DESC)');
            return;
        }

        if ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
            dbExecute(
                'CREATE TABLE IF NOT EXISTS rp_testes_historico (
                    id BIGSERIAL PRIMARY KEY,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    treinador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                    prova VARCHAR(20) NULL,
                    tempo_segundos INTEGER NOT NULL,
                    distancia_km DOUBLE PRECISION NOT NULL,
                    pace_segundos_km DOUBLE PRECISION NOT NULL,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )'
            );
            if (!dbColumnExists('rp_testes_historico', 'prova')) {
                dbExecute('ALTER TABLE rp_testes_historico ADD COLUMN IF NOT EXISTS prova VARCHAR(20)');
            }
            if (!dbColumnExists('rp_testes_historico', 'distancia_km')) {
                dbExecute('ALTER TABLE rp_testes_historico ADD COLUMN IF NOT EXISTS distancia_km DOUBLE PRECISION');
            }
            dbExecute('CREATE INDEX IF NOT EXISTS idx_rp_testes_usuario_data ON rp_testes_historico(usuario_id, criado_em DESC)');
            return;
        }

        dbExecute(
            'CREATE TABLE IF NOT EXISTS rp_testes_historico (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                treinador_id INT NOT NULL,
                prova VARCHAR(20) NULL,
                tempo_segundos INT NOT NULL,
                distancia_km DECIMAL(10,4) NOT NULL,
                pace_segundos_km DECIMAL(10,4) NOT NULL,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_rp_testes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                CONSTRAINT fk_rp_testes_treinador FOREIGN KEY (treinador_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )'
        );

        if (!dbColumnExists('rp_testes_historico', 'prova')) {
            try {
                dbExecute('ALTER TABLE rp_testes_historico ADD COLUMN prova VARCHAR(20) NULL AFTER treinador_id');
            } catch (Throwable $e) {
                // Coluna pode ter sido criada em corrida.
            }
        }

        try {
            if (!dbColumnExists('rp_testes_historico', 'distancia_km')) {
                dbExecute('ALTER TABLE rp_testes_historico ADD COLUMN distancia_km DECIMAL(10,4) NULL AFTER tempo_segundos');
            }
        } catch (Throwable $e) {
            // Coluna pode ter sido criada em corrida.
        }

        try {
            dbExecute('CREATE INDEX idx_rp_testes_usuario_data ON rp_testes_historico(usuario_id, criado_em)');
        } catch (Throwable $e) {
            // Índice já pode existir.
        }
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] ensureRpTestesTable ignorado: ' . $e->getMessage());
    }
}

function ensureDbHealthChecksTable(): void
{
    try {
        $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));

        if ($driver === 'sqlite') {
            dbExecute(
                'CREATE TABLE IF NOT EXISTS db_health_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token TEXT NOT NULL,
                    payload TEXT NULL,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                )'
            );
            dbExecute('CREATE INDEX IF NOT EXISTS idx_db_health_checks_token ON db_health_checks(token)');
            return;
        }

        if ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
            dbExecute(
                'CREATE TABLE IF NOT EXISTS db_health_checks (
                    id BIGSERIAL PRIMARY KEY,
                    token VARCHAR(64) NOT NULL,
                    payload TEXT NULL,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )'
            );
            dbExecute('CREATE INDEX IF NOT EXISTS idx_db_health_checks_token ON db_health_checks(token)');
            return;
        }

        dbExecute(
            'CREATE TABLE IF NOT EXISTS db_health_checks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token VARCHAR(64) NOT NULL,
                payload TEXT NULL,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )'
        );
        try {
            dbExecute('CREATE INDEX idx_db_health_checks_token ON db_health_checks(token)');
        } catch (Throwable $e) {
            // Indice ja existe.
        }
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] ensureDbHealthChecksTable ignorado: ' . $e->getMessage());
    }
}

function runDbPersistenceHealthCheck(): array
{
    ensureDbHealthChecksTable();

    $token = bin2hex(random_bytes(12));
    $startedAt = microtime(true);
    $inserted = false;
    $readBack = false;
    $deleted = false;
    $error = null;

    try {
        dbExecute(
            'INSERT INTO db_health_checks (token, payload) VALUES (:token, :payload)',
            [
                ':token' => $token,
                ':payload' => json_encode(['origin' => 'db-health-check', 'time' => date('c')], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]
        );
        $inserted = true;

        $row = dbFetchOne('SELECT id, token FROM db_health_checks WHERE token = :token LIMIT 1', [':token' => $token]);
        $readBack = $row !== null;

        if ($readBack) {
            dbExecute('DELETE FROM db_health_checks WHERE token = :token', [':token' => $token]);
            $deleted = true;
        }
    } catch (Throwable $e) {
        $error = $e->getMessage();
        try {
            dbExecute('DELETE FROM db_health_checks WHERE token = :token', [':token' => $token]);
        } catch (Throwable $inner) {
            // Sem impacto para o retorno do health-check.
        }
    }

    $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
    $ok = $inserted && $readBack && $deleted;

    return [
        'ok' => $ok,
        'duration_ms' => $durationMs,
        'inserted' => $inserted,
        'read_back' => $readBack,
        'deleted_probe' => $deleted,
        'error' => $ok ? null : $error,
        'checked_at' => date('c'),
    ];
}

function buildRpTestesHistoricoMap(array $usuarioIds): array
{
    $ids = array_values(array_unique(array_filter(array_map(static fn ($id) => (int) $id, $usuarioIds), static fn ($id) => $id > 0)));
    if (!$ids) {
        return [];
    }

    $placeholders = [];
    $params = [];
    foreach ($ids as $index => $usuarioId) {
        $placeholder = ':uid' . $index;
        $placeholders[] = $placeholder;
        $params[$placeholder] = $usuarioId;
    }

    $hasProva = safeDbColumnExists('rp_testes_historico', 'prova');
    $hasDistancia = safeDbColumnExists('rp_testes_historico', 'distancia_km');
    $hasPace = safeDbColumnExists('rp_testes_historico', 'pace_segundos_km');

    try {
        $rows = dbFetchAll(
            'SELECT h.id, h.usuario_id, h.treinador_id, '
                . ($hasProva ? 'h.prova' : 'NULL AS prova') . ', '
                . 'h.tempo_segundos, '
                . ($hasDistancia ? 'h.distancia_km' : 'NULL AS distancia_km') . ', '
                . ($hasPace ? 'h.pace_segundos_km' : 'NULL AS pace_segundos_km') . ', '
                . 'h.criado_em, '
                . 't.nome AS treinador_nome '
            . 'FROM rp_testes_historico h '
            . 'LEFT JOIN usuarios t ON t.id = h.treinador_id '
            . 'WHERE h.usuario_id IN (' . implode(', ', $placeholders) . ') '
            . 'ORDER BY h.criado_em DESC, h.id DESC',
            $params
        );
    } catch (Throwable $e) {
        $rows = [];
    }

    $fallbackRows = array_values(array_filter(loadFallbackTests(), static function ($item) use ($ids) {
        $uid = (int) ($item['usuario_id'] ?? 0);
        return $uid > 0 && in_array($uid, $ids, true);
    }));

    if ($fallbackRows) {
        $rows = array_merge($rows, $fallbackRows);
    }

    $historico = [];
    foreach ($rows as $row) {
        $usuarioId = (int) ($row['usuario_id'] ?? 0);
        $testeId = (int) ($row['id'] ?? 0);
        if ($usuarioId <= 0) {
            continue;
        }

        if ($testeId > 0 && isTestSoftDeleted($usuarioId, $testeId)) {
            continue;
        }

        $prova = (string) ($row['prova'] ?? '');
        $tempoSegundos = (int) ($row['tempo_segundos'] ?? 0);
        $distancia = isset($row['distancia_km']) && is_numeric($row['distancia_km'])
            ? (float) $row['distancia_km']
            : ((isset(RACE_DISTANCES[$prova]) && is_numeric(RACE_DISTANCES[$prova])) ? (float) RACE_DISTANCES[$prova] : null);
        $paceSegundosKm = isset($row['pace_segundos_km']) && is_numeric($row['pace_segundos_km'])
            ? (float) $row['pace_segundos_km']
            : null;

        $override = $testeId > 0 ? getEditedTestOverride($usuarioId, $testeId) : null;
        if (is_array($override)) {
            if (isset($override['tempo_segundos']) && is_numeric($override['tempo_segundos'])) {
                $tempoSegundos = (int) $override['tempo_segundos'];
            }

            if (isset($override['distancia_km']) && is_numeric($override['distancia_km'])) {
                $distancia = (float) $override['distancia_km'];
            }

            if (isset($override['pace_segundos_km']) && is_numeric($override['pace_segundos_km'])) {
                $paceSegundosKm = (float) $override['pace_segundos_km'];
            } elseif ($distancia !== null && $distancia > 0 && $tempoSegundos > 0) {
                $paceSegundosKm = $tempoSegundos / $distancia;
            }
        }

        $historico[$usuarioId] ??= [];
        $historico[$usuarioId][] = [
            'id' => $testeId,
            'prova' => $prova !== '' ? $prova : null,
            'tempo_segundos' => $tempoSegundos,
            'tempo_formatado' => formatSecondsToRaceTime($tempoSegundos),
            'distancia_km' => $distancia,
            'pace_segundos_km' => $paceSegundosKm,
            'pace_formatado' => formatPace($paceSegundosKm),
            'criado_em' => $row['criado_em'] ?? null,
            'treinador_id' => (int) ($row['treinador_id'] ?? 0),
            'treinador_nome' => (string) ($row['treinador_nome'] ?? ''),
        ];
    }

    return $historico;
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

function calculateApprovedPerformanceScore(array $user): ?float
{
    $weightedPaceSum = 0.0;
    $weightTotal = 0.0;

    foreach (RACE_DISTANCES as $column => $distanceKm) {
        $statusColumn = RP_STATUS_COLUMNS[$column] ?? null;
        $status = $statusColumn ? ($user[$statusColumn] ?? null) : null;
        if ($status !== 'aprovado') {
            continue;
        }

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

function mapRunnerForGroup(array $user, float $myScore, ?float $scoreOverride = null): array
{
    $score = $scoreOverride ?? calculatePerformanceScore($user);
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

function getShootingLevelLabel(int $index): string
{
    $labels = [
        '🐆 Guepardo',
        '🦌 Antilope',
        '🐺 Lobo',
        '🐎 Cavalo',
        '🦊 Raposa',
        '🐢 Tartaruga',
    ];

    return $labels[$index] ?? ('🐾 Pelotao ' . ($index + 1));
}

function getLatestValidShootingTest(array $historico): ?array
{
    foreach ($historico as $item) {
        $tempoSegundos = isset($item['tempo_segundos']) && is_numeric($item['tempo_segundos'])
            ? (float) $item['tempo_segundos']
            : 0.0;
        $distanciaKm = isset($item['distancia_km']) && is_numeric($item['distancia_km'])
            ? (float) $item['distancia_km']
            : 0.0;
        $pace = isset($item['pace_segundos_km']) && is_numeric($item['pace_segundos_km'])
            ? (float) $item['pace_segundos_km']
            : ($tempoSegundos > 0 && $distanciaKm > 0 ? ($tempoSegundos / $distanciaKm) : 0.0);

        if ($tempoSegundos > 0 && $distanciaKm > 0 && $pace > 0) {
            return [
                'tempo_segundos' => $tempoSegundos,
                'distancia_km' => $distanciaKm,
                'pace_segundos_km' => $pace,
            ];
        }
    }

    return null;
}

function calculateShootingTestScore(array $teste): ?float
{
    $tempoSegundos = isset($teste['tempo_segundos']) && is_numeric($teste['tempo_segundos'])
        ? (float) $teste['tempo_segundos']
        : 0.0;
    $distanciaKm = isset($teste['distancia_km']) && is_numeric($teste['distancia_km'])
        ? (float) $teste['distancia_km']
        : 0.0;
    $pace = isset($teste['pace_segundos_km']) && is_numeric($teste['pace_segundos_km'])
        ? (float) $teste['pace_segundos_km']
        : ($tempoSegundos > 0 && $distanciaKm > 0 ? ($tempoSegundos / $distanciaKm) : 0.0);

    if ($tempoSegundos <= 0 || $distanciaKm <= 0 || $pace <= 0) {
        return null;
    }

    $tempoMinutos = $tempoSegundos / 60.0;
    $bonusTempo = min(28.0, log(1.0 + max(0.0, $tempoMinutos - 4.0)) * 10.0);
    $bonusDistancia = min(22.0, log(1.0 + max(0.0, $distanciaKm - 0.8)) * 9.0);
    $score = $pace - $bonusTempo - $bonusDistancia;

    return $score > 0 ? $score : null;
}

function buildShootingGroups(array $users, array $historicoMap, float $compatThresholdPercent = 5.0): array
{
    $atletas = [];

    foreach ($users as $row) {
        $usuarioId = (int) ($row['id'] ?? 0);
        if ($usuarioId <= 0) {
            continue;
        }

        $teste = getLatestValidShootingTest($historicoMap[$usuarioId] ?? []);
        if (!$teste) {
            continue;
        }

        $score = calculateShootingTestScore($teste);
        if ($score === null) {
            continue;
        }

        $atletas[] = [
            'usuario_id' => $usuarioId,
            'nome' => (string) ($row['nome'] ?? ''),
            'score' => $score,
            'pace_segundos_km' => (float) $teste['pace_segundos_km'],
        ];
    }

    if (!$atletas) {
        return [];
    }

    usort($atletas, static fn($a, $b) => (float) $a['score'] <=> (float) $b['score']);

    $grupos = [];

    foreach ($atletas as $atleta) {
        $lastIndex = count($grupos) - 1;

        if ($lastIndex < 0) {
            $grupos[] = [
                'usuarios' => [$atleta],
                'media_score' => (float) $atleta['score'],
            ];
            continue;
        }

        $mediaAtual = (float) ($grupos[$lastIndex]['media_score'] ?? 0.0);
        if ($mediaAtual <= 0) {
            $grupos[] = [
                'usuarios' => [$atleta],
                'media_score' => (float) $atleta['score'],
            ];
            continue;
        }

        $diffPercent = abs((((float) $atleta['score']) - $mediaAtual) / $mediaAtual) * 100.0;
        if ($diffPercent <= $compatThresholdPercent) {
            $grupos[$lastIndex]['usuarios'][] = $atleta;
            $total = count($grupos[$lastIndex]['usuarios']);
            $grupos[$lastIndex]['media_score'] = (($mediaAtual * ($total - 1)) + (float) $atleta['score']) / $total;
            continue;
        }

        $grupos[] = [
            'usuarios' => [$atleta],
            'media_score' => (float) $atleta['score'],
        ];
    }

    $result = [];
    foreach ($grupos as $index => $grupo) {
        $paces = array_map(static fn($item) => (float) ($item['pace_segundos_km'] ?? 0), $grupo['usuarios']);
        $paces = array_values(array_filter($paces, static fn($value) => $value > 0));
        sort($paces);

        if (!$paces) {
            continue;
        }

        $result[] = [
            'id' => $index + 1,
            'nome_nivel' => getShootingLevelLabel($index),
            'melhor_pace_seg_km' => $paces[0],
            'pior_pace_seg_km' => $paces[count($paces) - 1],
            'melhor_pace_formatado' => formatPace($paces[0]),
            'pior_pace_formatado' => formatPace($paces[count($paces) - 1]),
            'usuarios' => array_map(static fn($item) => [
                'usuario_id' => (int) ($item['usuario_id'] ?? 0),
                'nome' => (string) ($item['nome'] ?? ''),
            ], $grupo['usuarios']),
        ];
    }

    return $result;
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

if (str_starts_with($path, '/api/')) {
    ensureCoreTables();
    ensureUsuariosCompatibilityColumns();
    ensureRpTestesTable();
    trackAlunoApiActivity($method, $path);

    $passwordChangeAllowedPaths = [
        '/api/auth/session',
        '/api/auth/logout',
        '/api/auth/alterar-senha-primeiro-acesso',
    ];

    if ((int) ($_SESSION['userId'] ?? 0) > 0 && sessionRequiresPasswordChange() && !in_array($path, $passwordChangeAllowedPaths, true)) {
        jsonResponse(['error' => 'É necessário trocar a senha temporária antes de continuar'], 403);
    }
}

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

    $usuarioExistente = dbFetchOne(
        'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(:email) LIMIT 1',
        [':email' => $email]
    );
    if ($usuarioExistente) {
        jsonResponse(['error' => 'E-mail já cadastrado'], 400);
    }

    $verificationRequired = false;

    try {
        $pdo = db();
        $pdo->beginTransaction();

        $insertColumns = ['nome', 'email', 'senha', 'sexo'];
        $insertParams = [
            ':nome' => $nome,
            ':email' => $email,
            ':senha' => password_hash($senha, PASSWORD_DEFAULT),
            ':sexo' => $sexo,
        ];

        if (safeDbColumnExists('usuarios', 'email_verificado')) {
            $insertColumns[] = 'email_verificado';
            $insertParams[':email_verificado'] = 1;
        }

        $placeholders = array_map(static fn (string $column): string => ':' . $column, $insertColumns);
        dbExecute(
            'INSERT INTO usuarios (' . implode(', ', $insertColumns) . ') VALUES (' . implode(', ', $placeholders) . ')',
            $insertParams
        );
        $userId = dbLastInsertId();

        $pdo->commit();

        $_SESSION['userId'] = $userId;
        $_SESSION['nome'] = $nome;
        $_SESSION['sexo'] = $sexo;
        $_SESSION['email'] = $email;
        $_SESSION['perfil'] = 'aluno';
        $_SESSION['requirePasswordChange'] = false;
    } catch (PDOException $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        error_log('[AgeRun PHP] Erro PDO em /api/auth/cadastro: ' . $e->getMessage());
        if (($e->getCode() ?? '') === '23000') {
            jsonResponse(['error' => 'E-mail já cadastrado'], 400);
        }
        jsonResponse(['error' => 'Erro ao cadastrar usuário'], 500);
    } catch (Throwable $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        jsonResponse(['error' => 'Erro ao cadastrar usuário: ' . $e->getMessage()], 500);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Cadastro e login realizados com sucesso.',
        'verification_required' => false,
        'auto_login' => true,
        'require_password_change' => false,
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

        if (empty($usuario['email_verificado'])) {
            jsonResponse([
                'error' => 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou solicite um novo envio.',
                'email_verification_required' => true,
            ], 403);
        }

        $_SESSION['userId'] = (int) $usuario['id'];
        $_SESSION['nome'] = (string) $usuario['nome'];
        $_SESSION['sexo'] = (string) ($usuario['sexo'] ?? 'masculino');
        $_SESSION['email'] = (string) ($usuario['email'] ?? '');
        $_SESSION['perfil'] = (string) ($usuario['perfil'] ?? 'aluno');
        $_SESSION['requirePasswordChange'] = !empty($usuario['senha_temporaria']);

        if (isAlunoSnapshot([
            'email' => (string) ($usuario['email'] ?? ''),
            'perfil' => (string) ($usuario['perfil'] ?? 'aluno'),
        ])) {
            appendMonitorEvent([
                'event_type' => 'login',
                'method' => 'POST',
                'path' => '/api/auth/login',
                'user_id' => (int) ($usuario['id'] ?? 0),
                'user_nome' => (string) ($usuario['nome'] ?? ''),
                'user_email' => normalizeEmail((string) ($usuario['email'] ?? '')),
                'ip' => currentClientIp(),
            ]);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Login realizado com sucesso!',
            'require_password_change' => sessionRequiresPasswordChange(),
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
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        $isDevPath = str_starts_with($uriPath, '/dev/');
        $payload = ['error' => 'Erro interno do servidor'];
        if ($isDebug || $isDevPath) {
            $payload['debug'] = $e->getMessage();
        }
        jsonResponse($payload, 500);
    }
}

if ($method === 'POST' && $path === '/api/auth/reenviar-confirmacao') {
    $input = jsonInput();
    $email = strtolower(trim((string) ($input['email'] ?? '')));

    if ($email === '') {
        jsonResponse(['error' => 'E-mail é obrigatório'], 400);
    }

    $usuario = dbFetchOne('SELECT id, nome, email, email_verificado FROM usuarios WHERE email = :email LIMIT 1', [':email' => $email]);
    if (!$usuario) {
        jsonResponse(['error' => 'E-mail não cadastrado'], 404);
    }

    if (!empty($usuario['email_verificado'])) {
        jsonResponse(['success' => true, 'message' => 'Este e-mail já foi confirmado. Faça login normalmente.']);
    }

    $verificationToken = generateEmailVerificationToken();
    $verificationExpiresAt = (new DateTimeImmutable('+24 hours'))->format('Y-m-d H:i:s');

    dbExecute(
        'UPDATE usuarios SET email_verificacao_token = :token, email_verificacao_expiracao = :expiracao WHERE id = :id',
        [
            ':token' => $verificationToken,
            ':expiracao' => $verificationExpiresAt,
            ':id' => (int) $usuario['id'],
        ]
    );

    if (!enviarEmailConfirmacaoCadastro((string) $usuario['email'], (string) $usuario['nome'], $verificationToken)) {
        jsonResponse(['error' => 'Não foi possível reenviar o e-mail de confirmação no momento.'], 500);
    }

    jsonResponse(['success' => true, 'message' => 'E-mail de confirmação reenviado com sucesso.']);
}

if ($method === 'GET' && $path === '/confirmar-email') {
    $token = trim((string) ($_GET['token'] ?? ''));
    if ($token === '') {
        redirectTo(buildVerificationRedirectPath('token-invalido'));
    }

    $usuario = dbFetchOne(
        'SELECT id, email, email_verificado, email_verificacao_expiracao FROM usuarios WHERE email_verificacao_token = :token LIMIT 1',
        [':token' => $token]
    );

    if (!$usuario) {
        redirectTo(buildVerificationRedirectPath('token-invalido'));
    }

    if (!empty($usuario['email_verificado'])) {
        redirectTo(buildVerificationRedirectPath('ja-confirmado', (string) ($usuario['email'] ?? '')));
    }

    $expiresAtRaw = (string) ($usuario['email_verificacao_expiracao'] ?? '');
    if ($expiresAtRaw === '') {
        redirectTo(buildVerificationRedirectPath('token-invalido', (string) ($usuario['email'] ?? '')));
    }

    $expiresAt = new DateTimeImmutable($expiresAtRaw);
    if (new DateTimeImmutable('now') > $expiresAt) {
        redirectTo(buildVerificationRedirectPath('token-expirado', (string) ($usuario['email'] ?? '')));
    }

    dbExecute(
        'UPDATE usuarios SET email_verificado = 1, email_verificacao_token = NULL, email_verificacao_expiracao = NULL WHERE id = :id',
        [':id' => (int) $usuario['id']]
    );

    redirectTo(buildVerificationRedirectPath('confirmado', (string) ($usuario['email'] ?? '')));
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    $logoutUser = getUserSnapshotById((int) ($_SESSION['userId'] ?? 0));
    if (is_array($logoutUser) && isAlunoSnapshot($logoutUser)) {
        appendMonitorEvent([
            'event_type' => 'logout',
            'method' => 'POST',
            'path' => '/api/auth/logout',
            'user_id' => (int) ($logoutUser['id'] ?? 0),
            'user_nome' => (string) ($logoutUser['nome'] ?? ''),
            'user_email' => normalizeEmail((string) ($logoutUser['email'] ?? '')),
            'ip' => currentClientIp(),
        ]);
    }

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
        try {
            $usuario = dbFetchOne(
                'SELECT id, nome, email, altura, sexo, perfil, senha_temporaria FROM usuarios WHERE id = :id LIMIT 1',
                [':id' => $userId]
            );
        } catch (PDOException) {
            $usuario = dbFetchOne('SELECT id, nome, email FROM usuarios WHERE id = :id LIMIT 1', [':id' => $userId]);
            if ($usuario) {
                $usuario['altura'] = null;
                $usuario['sexo'] = 'masculino';
                $usuario['perfil'] = 'aluno';
                $usuario['senha_temporaria'] = 0;
            }
        }
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] Erro em /api/auth/session: ' . $e->getMessage());
        $_SESSION = [];
        jsonResponse(['authenticated' => false]);
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
    $_SESSION['requirePasswordChange'] = !empty($usuario['senha_temporaria']);
    $usuario['require_password_change'] = sessionRequiresPasswordChange();
    $usuario['authenticated'] = true;
    jsonResponse($usuario);
}

if ($method === 'POST' && $path === '/api/auth/alterar-senha-primeiro-acesso') {
    $userId = requireAuth();
    $input = jsonInput();

    $novaSenha = (string) ($input['novaSenha'] ?? '');
    if (mb_strlen($novaSenha) < 6) {
        jsonResponse(['error' => 'A nova senha deve ter no mínimo 6 caracteres'], 400);
    }

    dbExecute(
        'UPDATE usuarios
         SET senha = :senha,
             senha_temporaria = 0,
             codigo_recuperacao = NULL,
             codigo_expiracao = NULL
         WHERE id = :id',
        [
            ':senha' => password_hash($novaSenha, PASSWORD_DEFAULT),
            ':id' => $userId,
        ]
    );

    $_SESSION['requirePasswordChange'] = false;
    jsonResponse(['success' => true, 'message' => 'Senha alterada com sucesso']);
}

if ($method === 'GET' && $path === '/api/admin/db-health') {
    requireTrainerAuth();

    $dbCheck = runDbPersistenceHealthCheck();
    $fallback = [
        'pending_insert_fallback' => count(loadFallbackTests()),
        'pending_edit_overrides' => count(loadEditedTestsList()),
        'pending_soft_deletes' => count(loadDeletedTestsList()),
    ];

    jsonResponse([
        'success' => $dbCheck['ok'],
        'db' => $dbCheck,
        'fallback' => $fallback,
    ], $dbCheck['ok'] ? 200 : 503);
}

if ($method === 'GET' && $path === '/api/admin/monitoramento/feed') {
    requireMonitorOwnerAuth();

    $limit = (int) ($_GET['limit'] ?? 120);
    if ($limit < 20) {
        $limit = 20;
    }
    if ($limit > 500) {
        $limit = 500;
    }

    $sinceUnix = (int) ($_GET['since'] ?? 0);
    $events = readMonitorEvents($limit, $sinceUnix);
    $installedUsers = getMonitorInstalledUsers();
    $fiveMinutesAgo = time() - 300;

    $activeUsers = [];
    foreach ($events as $event) {
        $eventTs = (int) ($event['ts_unix'] ?? 0);
        $eventUserId = (int) ($event['user_id'] ?? 0);
        if ($eventTs >= $fiveMinutesAgo && $eventUserId > 0) {
            $activeUsers[$eventUserId] = true;
        }
    }

    jsonResponse([
        'success' => true,
        'events' => $events,
        'installed_users' => $installedUsers,
        'summary' => [
            'total' => count($events),
            'ativos_5_min' => count($activeUsers),
            'instalados_total' => count($installedUsers),
            'ultima_atividade_ts' => count($events) > 0 ? (int) ($events[count($events) - 1]['ts_unix'] ?? 0) : null,
        ],
        'server_time' => time(),
    ]);
}

if ($method === 'GET' && $path === '/api/admin/db-structure') {
    requireMonitorOwnerAuth();

    $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));
    $tables = [];

    try {
        if ($driver === 'sqlite') {
            $tables = dbFetchAll("SELECT name AS table_name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
            $tables = dbFetchAll(
                'SELECT table_name FROM information_schema.tables WHERE table_schema = CURRENT_SCHEMA() ORDER BY table_name'
            );
        } else {
            $tables = dbFetchAll('SHOW TABLES');
        }
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Falha ao listar tabelas: ' . $e->getMessage()], 500);
    }

    $normalizedTables = array_values(array_filter(array_map(static function (array $row) use ($driver): ?string {
        if ($driver === 'sqlite') {
            $value = (string) ($row['table_name'] ?? $row['name'] ?? '');
        } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
            $value = (string) ($row['table_name'] ?? '');
        } else {
            $values = array_values($row);
            $value = (string) ($values[0] ?? '');
        }

        $value = trim($value);
        return $value === '' ? null : $value;
    }, $tables)));

    $schemas = [];
    foreach ($normalizedTables as $table) {
        try {
            if ($driver === 'sqlite') {
                $schemas[$table] = dbFetchAll("PRAGMA table_info({$table})");
            } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
                $schemas[$table] = dbFetchAll(
                    'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = :table ORDER BY ordinal_position',
                    [':table' => $table]
                );
            } else {
                $schemas[$table] = dbFetchAll(
                    'SHOW COLUMNS FROM `' . str_replace('`', '``', $table) . '`'
                );
            }
        } catch (Throwable) {
            $schemas[$table] = [];
        }
    }

    jsonResponse([
        'success' => true,
        'driver' => $driver,
        'tables' => $normalizedTables,
        'schemas' => $schemas,
    ]);
}

if ($method === 'POST' && $path === '/api/admin/db-query') {
    requireMonitorOwnerAuth();

    $input = jsonInput();
    $sql = trim((string) ($input['sql'] ?? ''));

    if ($sql === '') {
        jsonResponse(['error' => 'SQL é obrigatório'], 400);
    }

    if (preg_match('/;\s*\S/', $sql) === 1) {
        jsonResponse(['error' => 'Envie apenas uma instrução SQL por vez'], 400);
    }

    $operation = dbOperationFromSql($sql);
    if ($operation === 'unknown') {
        jsonResponse(['error' => 'Instrução SQL não suportada'], 400);
    }

    try {
        if (in_array($operation, ['select', 'show', 'pragma', 'describe', 'desc', 'with'], true)) {
            $rows = dbFetchAll($sql);
            jsonResponse([
                'success' => true,
                'type' => 'select',
                'row_count' => count($rows),
                'rows' => $rows,
            ]);
        }

        $affected = dbExecute($sql);
        jsonResponse([
            'success' => true,
            'type' => 'write',
            'affected_rows' => $affected,
        ]);
    } catch (Throwable $e) {
        jsonResponse([
            'error' => 'Falha ao executar SQL: ' . $e->getMessage(),
        ], 500);
    }
}

if ($method === 'GET' && $path === '/api/admin/query-tool/usuarios-ativos') {
    requireMonitorOwnerAuth();

    try {
        $rows = dbFetchAll(
            'SELECT u.id, u.nome, u.email, MAX(p.data_pesagem) AS ultima_pesagem
             FROM usuarios u
             INNER JOIN pesagens p ON p.usuario_id = u.id AND (p.excluido IS NULL OR p.excluido = 0)
             GROUP BY u.id, u.nome, u.email
             ORDER BY u.nome ASC'
        );
    } catch (Throwable) {
        $rows = [];
    }

    if (!$rows) {
        $rows = dbFetchAll('SELECT id, nome, email, NULL AS ultima_pesagem FROM usuarios ORDER BY nome ASC');
    }

    jsonResponse([
        'success' => true,
        'usuarios' => $rows,
    ]);
}

if ($method === 'POST' && $path === '/api/admin/query-tool/reset-senha-preview') {
    requireMonitorOwnerAuth();

    $input = jsonInput();
    $userId = (int) ($input['user_id'] ?? 0);

    if ($userId <= 0) {
        jsonResponse(['error' => 'Usuário inválido'], 400);
    }

    $usuario = dbFetchOne('SELECT id, nome, email FROM usuarios WHERE id = :id LIMIT 1', [':id' => $userId]);
    if (!$usuario) {
        jsonResponse(['error' => 'Usuário não encontrado'], 404);
    }

    $senhaTemporaria = generateTemporaryPassword(10);
    $senhaHash = password_hash($senhaTemporaria, PASSWORD_DEFAULT);

    $sql = "UPDATE usuarios SET senha = '" . str_replace("'", "''", $senhaHash) . "', senha_temporaria = 1, codigo_recuperacao = NULL, codigo_expiracao = NULL WHERE id = " . (int) $userId . ";";

    jsonResponse([
        'success' => true,
        'usuario' => [
            'id' => (int) ($usuario['id'] ?? 0),
            'nome' => (string) ($usuario['nome'] ?? ''),
            'email' => (string) ($usuario['email'] ?? ''),
        ],
        'senha_temporaria' => $senhaTemporaria,
        'senha_hash' => $senhaHash,
        'update_sql' => $sql,
        'observacao' => 'Após aplicar o UPDATE, no próximo login o usuário será obrigado a trocar a senha.',
    ]);
}

if ($method === 'POST' && $path === '/api/monitoramento/pwa-status') {
    $userId = requireAuth();
    $snapshot = getUserSnapshotById($userId);

    if (!$snapshot || !isAlunoSnapshot($snapshot)) {
        jsonResponse(['success' => true, 'ignored' => true]);
    }

    $input = jsonInput();
    $source = strtolower(trim((string) ($input['source'] ?? 'heartbeat')));
    if (!in_array($source, ['heartbeat', 'appinstalled', 'standalone'], true)) {
        $source = 'heartbeat';
    }

    $platform = strtolower(trim((string) ($input['platform'] ?? 'mobile')));
    $platform = preg_replace('/[^a-z0-9_-]/', '', $platform) ?: 'mobile';
    $platform = substr($platform, 0, 24);

    $standalone = !empty($input['standalone']);
    $installed = !empty($input['installed']) || $standalone;
    $userAgent = substr(trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 260);

    $newInstall = upsertMonitorPwaStatus($snapshot, [
        'installed' => $installed,
        'source' => $source,
        'platform' => $platform,
        'user_agent' => $userAgent,
    ]);

    if ($newInstall) {
        appendMonitorEvent([
            'event_type' => 'pwa_installed',
            'method' => 'POST',
            'path' => '/api/monitoramento/pwa-status',
            'user_id' => (int) ($snapshot['id'] ?? 0),
            'user_nome' => (string) ($snapshot['nome'] ?? ''),
            'user_email' => normalizeEmail((string) ($snapshot['email'] ?? '')),
            'ip' => currentClientIp(),
        ]);
    }

    jsonResponse([
        'success' => true,
        'installed' => $installed,
        'new_install' => $newInstall,
    ]);
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

    $emailWarning = getLastEmailError();
    if ($emailWarning === '') {
        $emailWarning = 'Falha ao enviar o e-mail de recuperação.';
    }

    jsonResponse([
        'success' => true,
        'message' => 'Código gerado. Verifique o console do servidor.',
        'warning' => $emailWarning,
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
                u.email,
                (SELECT peso FROM pesagens WHERE usuario_id = u.id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem ASC LIMIT 1) AS peso_inicial,
                (SELECT peso FROM pesagens WHERE usuario_id = u.id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC LIMIT 1) AS peso_atual,
                COUNT(p.id) AS total_pesagens
             FROM usuarios u
             LEFT JOIN pesagens p ON u.id = p.usuario_id AND (p.excluido IS NULL OR excluido = 0)
             GROUP BY u.id, u.nome, u.email
             HAVING COUNT(p.id) > 0'
        );
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar ranking'], 500);
    }

    $ranking = [];
    foreach ($rows as $row) {
        if (isHiddenFromRankingEmail((string) ($row['email'] ?? ''))) {
            continue;
        }

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
    $rows = dbFetchAll('SELECT id, nome, rp_5k, rp_10k, rp_21k, rp_42k, rp_5k_status, rp_10k_status, rp_21k_status, rp_42k_status FROM usuarios');

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

    $meuScore = calculateApprovedPerformanceScore($usuarioLogado);
    if ($meuScore === null) {
        jsonResponse([
            'meu_nivel' => null,
            'grupos' => [
                'mesmo_nivel' => [],
                'nivel_mais_alto' => [],
                'nivel_mais_baixo' => [],
            ],
            'aviso' => 'Seus grupos de treino serão exibidos após o treinador aprovar ao menos um RP.',
        ]);
    }

    $candidatos = [];
    foreach ($rows as $row) {
        if ((int) ($row['id'] ?? 0) === $usuarioId) {
            continue;
        }
        $score = calculateApprovedPerformanceScore($row);
        if ($score === null) {
            continue;
        }
        $candidatos[] = mapRunnerForGroup($row, $meuScore, $score);
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

if ($method === 'GET' && $path === '/api/performance/grupos-tiro') {
    $usuarioId = requireAuth();

    $rows = dbFetchAll(
        'SELECT u.id, u.nome
           FROM usuarios u
          WHERE EXISTS (
                SELECT 1
                  FROM pesagens p
                 WHERE p.usuario_id = u.id
                   AND (p.excluido IS NULL OR p.excluido = 0)
          )
          ORDER BY u.nome ASC'
    );

    if (!$rows) {
        jsonResponse([
            'meu_grupo' => null,
            'grupos' => [],
            'aviso' => 'Nenhum usuário ativo encontrado para montar grupos de tiro.',
        ]);
    }

    $historicoMap = buildRpTestesHistoricoMap(array_map(static fn ($row) => (int) ($row['id'] ?? 0), $rows));
    $grupos = buildShootingGroups($rows, $historicoMap);

    if (!$grupos) {
        jsonResponse([
            'meu_grupo' => null,
            'grupos' => [],
            'aviso' => 'Sem testes válidos para montar os grupos de tiro.',
        ]);
    }

    $meuGrupo = null;
    foreach ($grupos as $grupo) {
        foreach (($grupo['usuarios'] ?? []) as $membro) {
            if ((int) ($membro['usuario_id'] ?? 0) === $usuarioId) {
                $meuGrupo = $grupo;
                break 2;
            }
        }
    }

    jsonResponse([
        'meu_grupo' => $meuGrupo,
        'grupos' => $grupos,
        'aviso' => $meuGrupo ? null : 'Você ainda não possui teste válido para entrar em um grupo de tiro.',
    ]);
}

if ($method === 'GET' && $path === '/api/treinador/usuarios-ativos') {
    requireTrainerAuth();

    $usuarioColumns = [
        'altura',
        'rp_5k', 'rp_10k', 'rp_21k', 'rp_42k',
        'rp_5k_status', 'rp_10k_status', 'rp_21k_status', 'rp_42k_status',
    ];
    $pesagemColumns = [
        'gordura_percentual', 'massa_muscular_percentual', 'agua_percentual',
        'massa_ossea', 'metabolismo_basal', 'idade_metabolica', 'gordura_visceral',
        'excluido',
    ];

    $select = static function (string $tableAlias, string $tableName, string $column): string {
        if (dbColumnExists($tableName, $column)) {
            return sprintf('%s.%s AS %s', $tableAlias, $column, $column);
        }

        return sprintf('NULL AS %s', $column);
    };

    $usuarioSelectParts = [];
    foreach ($usuarioColumns as $column) {
        $usuarioSelectParts[] = $select('u', 'usuarios', $column);
    }

    $pesagemSelectParts = [];
    foreach ($pesagemColumns as $column) {
        if ($column === 'excluido') {
            continue;
        }
        $pesagemSelectParts[] = $select('p', 'pesagens', $column);
    }

    $excluidoPredicate = dbColumnExists('pesagens', 'excluido')
        ? '(p2.excluido IS NULL OR p2.excluido = 0)'
        : '1=1';

    $query = sprintf('
        SELECT
          u.id,
          u.nome,
          u.email,
          %s,
          p.peso AS peso_atual,
          p.data_pesagem,
          %s
        FROM usuarios u
        LEFT JOIN pesagens p ON p.id = (
          SELECT p2.id
          FROM pesagens p2
          WHERE p2.usuario_id = u.id AND %s
          ORDER BY p2.data_pesagem DESC, p2.id DESC
          LIMIT 1
        )
        WHERE EXISTS (
          SELECT 1
          FROM pesagens p3
          WHERE p3.usuario_id = u.id AND %s
        )
        ORDER BY u.nome ASC
    ', implode(",\n          ", $usuarioSelectParts), implode(",\n          ", $pesagemSelectParts), $excluidoPredicate, str_replace('p2.', 'p3.', $excluidoPredicate));

    $rows = dbFetchAll($query);

    try {
        $historicoMap = buildRpTestesHistoricoMap(array_map(static fn ($row) => (int) ($row['id'] ?? 0), $rows));
    } catch (Throwable $e) {
        // Ambiente legado pode não ter tabela/colunas de histórico ainda.
        $historicoMap = [];
    }

    $usuarios = array_map(static function ($row) use ($historicoMap) {
        $altura = isset($row['altura']) && $row['altura'] !== null ? (float) $row['altura'] : null;
        $pesoAtual = isset($row['peso_atual']) && $row['peso_atual'] !== null ? (float) $row['peso_atual'] : null;
        $imc = ($altura && $pesoAtual && $altura > 0)
            ? round($pesoAtual / ($altura * $altura), 2)
            : null;
        $usuarioId = (int) ($row['id'] ?? 0);

        return [
            'usuario_id' => $usuarioId,
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
            'rp_testes_historico' => $historicoMap[$usuarioId] ?? [],
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

if ($method === 'POST' && preg_match('#^/api/treinador/usuarios/(\d+)/testes$#', $path, $matches) === 1) {
    $treinadorId = requireTrainerAuth();

    $alvoUsuarioId = (int) $matches[1];
    $input = jsonInput();
    $tempoSegundos = parseRaceTimeToSeconds($input['tempo'] ?? null);
    $distanciaKm = isset($input['distancia_km']) ? (float) $input['distancia_km'] : 0.0;

    if ($tempoSegundos === -1 || $tempoSegundos === null || $tempoSegundos <= 0) {
        jsonResponse(['error' => 'Tempo do teste inválido'], 400);
    }

    if ($distanciaKm <= 0 || $distanciaKm > 1000) {
        jsonResponse(['error' => 'Distância do teste inválida'], 400);
    }

    $usuario = dbFetchOne('SELECT id FROM usuarios WHERE id = :id LIMIT 1', [':id' => $alvoUsuarioId]);
    if (!$usuario) {
        jsonResponse(['error' => 'Usuário não encontrado'], 404);
    }

    $paceSegundosKm = $tempoSegundos / $distanciaKm;

    try {
        $testeId = insertRpTesteHistoricoCompat($alvoUsuarioId, $treinadorId, $tempoSegundos, $distanciaKm, $paceSegundosKm);
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] Falha ao salvar teste: ' . $e->getMessage());
        jsonResponse([
            'error' => 'Erro ao salvar teste: ' . $e->getMessage(),
        ], 500);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Teste registrado com sucesso',
        'teste' => [
            'id' => $testeId,
            'tempo_segundos' => $tempoSegundos,
            'tempo_formatado' => formatSecondsToRaceTime($tempoSegundos),
            'distancia_km' => $distanciaKm,
            'pace_segundos_km' => $paceSegundosKm,
            'pace_formatado' => formatPace($paceSegundosKm),
        ],
    ], 201);
}

if ($method === 'PUT' && preg_match('#^/api/treinador/usuarios/(\d+)/testes/(\d+)$#', $path, $matches) === 1) {
    requireTrainerAuth();

    $alvoUsuarioId = (int) $matches[1];
    $testeId = (int) $matches[2];
    $input = jsonInput();
    $tempoSegundos = parseRaceTimeToSeconds($input['tempo'] ?? null);
    $distanciaKm = isset($input['distancia_km']) ? (float) $input['distancia_km'] : 0.0;

    if ($tempoSegundos === -1 || $tempoSegundos === null || $tempoSegundos <= 0) {
        jsonResponse(['error' => 'Tempo do teste inválido'], 400);
    }

    if ($distanciaKm <= 0 || $distanciaKm > 1000) {
        jsonResponse(['error' => 'Distância do teste inválida'], 400);
    }

    $paceSegundosKm = $tempoSegundos / $distanciaKm;

    $dbUpdated = false;

    try {
        try {
            $teste = dbFetchOne(
                'SELECT id, usuario_id FROM rp_testes_historico WHERE id = :id LIMIT 1',
                [':id' => $testeId]
            );

            if (!$teste || (int) ($teste['usuario_id'] ?? 0) !== $alvoUsuarioId) {
                jsonResponse(['error' => 'Teste não encontrado para este usuário'], 404);
            }
        } catch (Throwable $e) {
            // Compatibilidade com schema legado sem coluna usuario_id.
            try {
                $teste = dbFetchOne(
                    'SELECT id FROM rp_testes_historico WHERE id = :id LIMIT 1',
                    [':id' => $testeId]
                );

                if (!$teste) {
                    jsonResponse(['error' => 'Teste não encontrado para este usuário'], 404);
                }
            } catch (Throwable $inner) {
                // Sem leitura confiável do banco: segue com fallback em arquivo.
            }
        }

        $hasProva = safeDbColumnExists('rp_testes_historico', 'prova');
        $hasDistancia = safeDbColumnExists('rp_testes_historico', 'distancia_km');
        $hasPace = safeDbColumnExists('rp_testes_historico', 'pace_segundos_km');

        $setParts = ['tempo_segundos = :tempo_segundos'];
        $params = [
            ':tempo_segundos' => $tempoSegundos,
            ':id' => $testeId,
        ];

        if ($hasProva) {
            $setParts[] = 'prova = :prova';
            $params[':prova'] = 'teste';
        }

        if ($hasDistancia) {
            $setParts[] = 'distancia_km = :distancia_km';
            $params[':distancia_km'] = $distanciaKm;
        }

        if ($hasPace) {
            $setParts[] = 'pace_segundos_km = :pace_segundos_km';
            $params[':pace_segundos_km'] = $paceSegundosKm;
        }

        try {
            dbExecute(
                'UPDATE rp_testes_historico
                    SET ' . implode(",\n                        ", $setParts) . '
                  WHERE id = :id',
                $params
            );
            $dbUpdated = true;
        } catch (Throwable $e) {
            $fallbackCandidates = [
                ['tempo_segundos = :tempo_segundos, distancia_km = :distancia_km, pace_segundos_km = :pace_segundos_km', [':tempo_segundos' => $tempoSegundos, ':distancia_km' => $distanciaKm, ':pace_segundos_km' => $paceSegundosKm, ':id' => $testeId]],
                ['tempo_segundos = :tempo_segundos, distancia_km = :distancia_km', [':tempo_segundos' => $tempoSegundos, ':distancia_km' => $distanciaKm, ':id' => $testeId]],
                ['tempo_segundos = :tempo_segundos', [':tempo_segundos' => $tempoSegundos, ':id' => $testeId]],
            ];

            $attemptErrors = [];

            foreach ($fallbackCandidates as [$setClause, $fallbackParams]) {
                try {
                    dbExecute('UPDATE rp_testes_historico SET ' . $setClause . ' WHERE id = :id', $fallbackParams);
                    $dbUpdated = true;
                    break;
                } catch (Throwable $inner) {
                    $attemptErrors[] = $inner->getMessage();
                }
            }

            if (!$dbUpdated) {
                error_log('[AgeRun PHP] Falha ao atualizar teste (PUT): ' . $e->getMessage() . ' | tentativas: ' . implode(' || ', $attemptErrors));
            }
        }
    } catch (Throwable $fatal) {
        error_log('[AgeRun PHP] Erro inesperado no PUT de teste: ' . $fatal->getMessage());
    }

    if ($dbUpdated) {
        clearEditedTestOverride($alvoUsuarioId, $testeId);
    } else {
        upsertEditedTestOverride($alvoUsuarioId, $testeId, $tempoSegundos, $distanciaKm, $paceSegundosKm);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Teste atualizado com sucesso',
        'teste' => [
            'id' => $testeId,
            'tempo_segundos' => $tempoSegundos,
            'tempo_formatado' => formatSecondsToRaceTime($tempoSegundos),
            'distancia_km' => $distanciaKm,
            'pace_segundos_km' => $paceSegundosKm,
            'pace_formatado' => formatPace($paceSegundosKm),
        ],
    ]);
}

if ($method === 'DELETE' && preg_match('#^/api/treinador/usuarios/(\d+)/testes/(\d+)$#', $path, $matches) === 1) {
    requireTrainerAuth();

    $alvoUsuarioId = (int) $matches[1];
    $testeId = (int) $matches[2];

    try {
        $teste = dbFetchOne(
            'SELECT id, usuario_id FROM rp_testes_historico WHERE id = :id LIMIT 1',
            [':id' => $testeId]
        );

        if (!$teste || (int) ($teste['usuario_id'] ?? 0) !== $alvoUsuarioId) {
            if (isTestSoftDeleted($alvoUsuarioId, $testeId)) {
                jsonResponse([
                    'success' => true,
                    'message' => 'Teste excluído com sucesso',
                ]);
            }

            jsonResponse(['error' => 'Teste não encontrado para este usuário'], 404);
        }

        dbExecute('DELETE FROM rp_testes_historico WHERE id = :id', [':id' => $testeId]);
        unmarkTestSoftDeleted($alvoUsuarioId, $testeId);
        clearEditedTestOverride($alvoUsuarioId, $testeId);

        jsonResponse([
            'success' => true,
            'message' => 'Teste excluído com sucesso',
        ]);
    } catch (Throwable $e) {
        // Fallback para ambientes com schema/permissão legado no DELETE.
        markTestSoftDeleted($alvoUsuarioId, $testeId);
        clearEditedTestOverride($alvoUsuarioId, $testeId);
        jsonResponse([
            'success' => true,
            'message' => 'Teste excluído com sucesso',
        ]);
    }
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
    '/primeiro-acesso' => 'primeiro-acesso.html',
    '/home' => 'home.html',
    '/pesagem' => 'pesagem.html',
    '/ranking' => 'ranking.html',
    '/bioimpedancia' => 'bioimpedancia.html',
    '/grupos-treino' => 'grupos-treino.html',
    '/treinador' => 'treinador.html',
    '/monitoramento' => 'monitoramento.html',
    '/monitoramento-acessos' => 'monitoramento-acessos.html',
];

if ($path === '/' || $path === '') {
    if (empty($_SESSION['userId'])) {
        redirectTo('/login');
    }
    redirectTo('/home');
}

if (array_key_exists($path, $pages)) {
    $protectedPages = ['/home', '/pesagem', '/ranking', '/bioimpedancia', '/grupos-treino', '/treinador', '/monitoramento', '/monitoramento-acessos'];
    if (in_array($path, $protectedPages, true) && empty($_SESSION['userId'])) {
        redirectTo('/login');
    }

    if (in_array($path, $protectedPages, true) && sessionRequiresPasswordChange()) {
        redirectTo('/primeiro-acesso');
    }

    if ($path === '/primeiro-acesso' && empty($_SESSION['userId'])) {
        redirectTo('/login');
    }

    if ($path === '/primeiro-acesso' && !sessionRequiresPasswordChange()) {
        redirectTo('/home');
    }

    if ($path === '/monitoramento' || $path === '/monitoramento-acessos') {
        $snapshot = getUserSnapshotById((int) ($_SESSION['userId'] ?? 0));
        if (!$snapshot || !isMonitorOwnerEmail((string) ($snapshot['email'] ?? ''))) {
            redirectTo('/home');
        }
    }

    if (in_array($path, ['/home', '/pesagem', '/ranking', '/bioimpedancia', '/grupos-treino'], true)) {
        trackAlunoPageAccess($path);
    }

    sendHtml($pages[$path]);
}

if (str_starts_with($path, '/api/')) {
    jsonResponse(['error' => 'Rota de API não encontrada'], 404);
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Rota não encontrada';
