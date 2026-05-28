<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

const DB_MAX_ATTEMPTS = 2;
const DB_RETRY_DELAY_US = 120000;

function createSqlitePdo(array $config): PDO
{
    $defaultSqlitePath = dirname(__DIR__) . '/storage/peso.db';
    $sqlitePath = trim((string) ($config['database'] ?? ''));
    if ($sqlitePath === '') {
        $sqlitePath = $defaultSqlitePath;
    }

    $configuredDir = dirname($sqlitePath);
    $configuredPathUsable = is_file($sqlitePath) || is_dir($configuredDir);
    if (!$configuredPathUsable) {
        $sqlitePath = $defaultSqlitePath;
    }

    $fallbackDir = dirname($sqlitePath);
    if (!is_dir($fallbackDir)) {
        @mkdir($fallbackDir, 0775, true);
    }

    $dsn = 'sqlite:' . $sqlitePath;
    return new PDO($dsn);
}

function db(bool $forceReconnect = false): PDO
{
    static $pdo = null;

    if ($forceReconnect) {
        $pdo = null;
    }

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = appConfig()['db'];
    $driver = strtolower((string) ($config['driver'] ?? 'mysql'));

    if ($driver === 'sqlite') {
        $pdo = createSqlitePdo($config);
    } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
        $username = trim((string) ($config['username'] ?? ''));
        $database = trim((string) ($config['database'] ?? ''));
        if (isDevRequestPath() && ($username === '' || $database === '')) {
            error_log('[AgeRun PHP] DB pgsql incompleto em /dev, usando fallback sqlite');
            $pdo = createSqlitePdo(['database' => dirname(__DIR__) . '/storage/peso.db']);
        } else {
            try {
                $dsn = sprintf(
                    'pgsql:host=%s;port=%s;dbname=%s',
                    $config['host'],
                    $config['port'],
                    $config['database']
                );
                $pdo = new PDO($dsn, (string) $config['username'], (string) $config['password']);
            } catch (Throwable $e) {
                if (isDevRequestPath()) {
                    error_log('[AgeRun PHP] Falha pgsql em /dev, usando sqlite: ' . $e->getMessage());
                    $pdo = createSqlitePdo(['database' => dirname(__DIR__) . '/storage/peso.db']);
                } else {
                    throw $e;
                }
            }
        }
    } else {
        $username = trim((string) ($config['username'] ?? ''));
        $database = trim((string) ($config['database'] ?? ''));
        if (isDevRequestPath() && ($username === '' || $database === '')) {
            error_log('[AgeRun PHP] DB mysql incompleto em /dev, usando fallback sqlite');
            $pdo = createSqlitePdo(['database' => dirname(__DIR__) . '/storage/peso.db']);
        } else {
            try {
                $dsn = sprintf(
                    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                    $config['host'],
                    $config['port'],
                    $config['database'],
                    $config['charset']
                );
                $pdo = new PDO($dsn, (string) $config['username'], (string) $config['password']);
            } catch (Throwable $e) {
                if (isDevRequestPath()) {
                    error_log('[AgeRun PHP] Falha mysql em /dev, usando sqlite: ' . $e->getMessage());
                    $pdo = createSqlitePdo(['database' => dirname(__DIR__) . '/storage/peso.db']);
                } else {
                    throw $e;
                }
            }
        }
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    return $pdo;
}

function dbOperationFromSql(string $sql): string
{
    if (preg_match('/^\s*(insert|update|delete|replace|alter|create|drop|truncate)\b/i', $sql, $matches) === 1) {
        return strtolower((string) ($matches[1] ?? ''));
    }

    if (preg_match('/^\s*(select|show|pragma|describe|desc|with)\b/i', $sql, $matches) === 1) {
        return strtolower((string) ($matches[1] ?? ''));
    }

    return 'unknown';
}

function isDbWriteOperation(string $operation): bool
{
    return in_array($operation, ['insert', 'update', 'delete', 'replace', 'alter', 'create', 'drop', 'truncate'], true);
}

function isRetryableDbError(Throwable $e): bool
{
    $message = strtolower($e->getMessage());

    $retryPatterns = [
        'server has gone away',
        'lost connection',
        'connection reset',
        'connection refused',
        'database is locked',
        'deadlock',
        'lock wait timeout',
        'too many connections',
        'broken pipe',
        'could not connect',
    ];

    foreach ($retryPatterns as $pattern) {
        if (str_contains($message, $pattern)) {
            return true;
        }
    }

    return false;
}

function dbSqlForLog(string $sql): string
{
    $oneLine = preg_replace('/\s+/', ' ', trim($sql));
    if (!is_string($oneLine) || $oneLine === '') {
        return '[empty-sql]';
    }

    return strlen($oneLine) > 220 ? substr($oneLine, 0, 220) . '...' : $oneLine;
}

function dbPrepareExecuteWithRetry(string $sql, array $params = []): PDOStatement
{
    $operation = dbOperationFromSql($sql);
    $lastError = null;

    for ($attempt = 1; $attempt <= DB_MAX_ATTEMPTS; $attempt++) {
        try {
            $stmt = db($attempt > 1)->prepare($sql);
            $stmt->execute($params);

            if (isDbWriteOperation($operation)) {
                $affected = $stmt->rowCount();
                if ($affected === 0) {
                    error_log('[AgeRun PHP][DB] write sem linhas afetadas op=' . $operation . ' sql=' . dbSqlForLog($sql));
                }
            }

            return $stmt;
        } catch (Throwable $e) {
            $lastError = $e;
            $retryable = isRetryableDbError($e);

            error_log('[AgeRun PHP][DB] falha op=' . $operation . ' tentativa=' . $attempt . '/' . DB_MAX_ATTEMPTS . ' retryable=' . ($retryable ? 'yes' : 'no') . ' msg=' . $e->getMessage() . ' sql=' . dbSqlForLog($sql));

            if (!$retryable || $attempt >= DB_MAX_ATTEMPTS) {
                break;
            }

            usleep(DB_RETRY_DELAY_US * $attempt);
        }
    }

    if ($lastError instanceof Throwable) {
        throw $lastError;
    }

    throw new RuntimeException('Falha desconhecida ao executar operação de banco');
}

function dbFetchOne(string $sql, array $params = []): ?array
{
    $stmt = dbPrepareExecuteWithRetry($sql, $params);
    $result = $stmt->fetch();
    return $result === false ? null : $result;
}

function dbFetchAll(string $sql, array $params = []): array
{
    $stmt = dbPrepareExecuteWithRetry($sql, $params);
    return $stmt->fetchAll() ?: [];
}

function dbExecute(string $sql, array $params = []): int
{
    $stmt = dbPrepareExecuteWithRetry($sql, $params);
    return $stmt->rowCount();
}

function dbLastInsertId(): int
{
    return (int) db()->lastInsertId();
}
