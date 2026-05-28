<?php

declare(strict_types=1);

function loadEnv(string $path, bool $overrideExisting = false): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);

        if (!$overrideExisting) {
            $alreadySet = array_key_exists($key, $_ENV)
                || array_key_exists($key, $_SERVER)
                || getenv($key) !== false;

            if ($alreadySet) {
                continue;
            }
        }

        if ($value !== '' && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        }

        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        putenv("{$key}={$value}");
    }
}

function env(string $key, mixed $default = null): mixed
{
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
    return $value === false || $value === null || $value === '' ? $default : $value;
}

function appConfig(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $envCandidates = [
        dirname(__DIR__) . '/.env',
        dirname(__DIR__, 2) . '/.env',
    ];

    foreach ($envCandidates as $envPath) {
        loadEnv($envPath);
    }

    $config = [
        'app_env' => (string) env('APP_ENV', 'production'),
        'app_url' => (string) env('APP_URL', ''),
        'app_base_path' => trim((string) env('APP_BASE_PATH', '/controle')),
        'session_name' => (string) env('SESSION_NAME', 'age_run.sid'),
        'session_secret' => (string) env('SESSION_SECRET', 'age-run-secret-2026'),
        'db' => [
            'driver' => (string) env('DB_DRIVER', 'mysql'),
            'host' => (string) env('DB_HOST', '127.0.0.1'),
            'port' => (string) env('DB_PORT', '3306'),
            'database' => (string) env('DB_DATABASE', ''),
            'username' => (string) env('DB_USERNAME', ''),
            'password' => (string) env('DB_PASSWORD', ''),
            'charset' => (string) env('DB_CHARSET', 'utf8mb4'),
        ],
        'email' => [
            'from_name' => (string) env('EMAIL_FROM_NAME', 'Age Run'),
            'from_address' => (string) env('EMAIL_FROM_ADDRESS', ''),
        ],
    ];

    if ($config['app_base_path'] !== '' && $config['app_base_path'][0] !== '/') {
        $config['app_base_path'] = '/' . $config['app_base_path'];
    }

    return $config;
}
