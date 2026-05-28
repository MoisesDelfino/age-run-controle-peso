<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = appConfig()['db'];
    $driver = strtolower((string) ($config['driver'] ?? 'mysql'));

    if ($driver === 'sqlite') {
        $defaultSqlitePath = dirname(__DIR__) . '/storage/peso.db';
        $sqlitePath = trim((string) ($config['database'] ?? ''));
        if ($sqlitePath === '') {
            $sqlitePath = $defaultSqlitePath;
        }

        // Some deploy environments provide a stale absolute path in .env.
        // If that path is not usable, fallback to the project-local storage db.
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
        $pdo = new PDO($dsn);
    } elseif ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
        $dsn = sprintf(
            'pgsql:host=%s;port=%s;dbname=%s',
            $config['host'],
            $config['port'],
            $config['database']
        );
        $pdo = new PDO($dsn, (string) $config['username'], (string) $config['password']);
    } else {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['database'],
            $config['charset']
        );
        $pdo = new PDO($dsn, (string) $config['username'], (string) $config['password']);
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
