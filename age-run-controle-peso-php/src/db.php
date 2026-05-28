<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

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

function db(): PDO
{
    static $pdo = null;

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

function dbFetchOne(string $sql, array $params = []): ?array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $result = $stmt->fetch();
    return $result === false ? null : $result;
}

function dbFetchAll(string $sql, array $params = []): array
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
}

function dbExecute(string $sql, array $params = []): int
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function dbLastInsertId(): int
{
    return (int) db()->lastInsertId();
}
