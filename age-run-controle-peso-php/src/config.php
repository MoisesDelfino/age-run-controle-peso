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

function isDevRequestPath(): bool
{
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    return str_starts_with($uriPath, '/dev/');
}

function appConfig(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $isDevPath = isDevRequestPath();

    $envCandidates = [
        [dirname(__DIR__) . '/.env', false],
        [dirname(__DIR__, 2) . '/.env', false],
    ];

    if ($isDevPath) {
        $envCandidates[] = [dirname(__DIR__) . '/.env.dev', true];
        $envCandidates[] = [dirname(__DIR__, 2) . '/dev/.env', true];
        $envCandidates[] = [dirname(__DIR__, 2) . '/.env.dev', true];
    }

    foreach ($envCandidates as [$envPath, $overrideExisting]) {
        loadEnv($envPath, $overrideExisting);
    }

    $dbPrefix = $isDevPath ? 'DEV_DB_' : 'DB_';

    $config = [
        'app_env' => (string) env('APP_ENV', 'production'),
        'app_url' => (string) env('APP_URL', ''),
        'app_base_path' => trim((string) env($isDevPath ? 'DEV_APP_BASE_PATH' : 'APP_BASE_PATH', $isDevPath ? '/dev' : '/controle')),
        'session_name' => (string) env($isDevPath ? 'DEV_SESSION_NAME' : 'SESSION_NAME', $isDevPath ? 'age_run_dev.sid' : 'age_run.sid'),
        'session_secret' => (string) env('SESSION_SECRET', 'age-run-secret-2026'),
        'db' => [
            'driver' => (string) env($dbPrefix . 'DRIVER', (string) env('DB_DRIVER', 'mysql')),
            'host' => (string) env($dbPrefix . 'HOST', (string) env('DB_HOST', '127.0.0.1')),
            'port' => (string) env($dbPrefix . 'PORT', (string) env('DB_PORT', '3306')),
            'database' => (string) env($dbPrefix . 'DATABASE', (string) env('DB_DATABASE', '')),
            'username' => (string) env($dbPrefix . 'USERNAME', (string) env('DB_USERNAME', '')),
            'password' => (string) env($dbPrefix . 'PASSWORD', (string) env('DB_PASSWORD', '')),
            'charset' => (string) env($dbPrefix . 'CHARSET', (string) env('DB_CHARSET', 'utf8mb4')),
        ],
        'email' => [
            'transport' => (string) env('EMAIL_TRANSPORT', 'mail'),
            'from_name' => (string) env('EMAIL_FROM_NAME', 'Age Run'),
            'from_address' => (string) env('EMAIL_FROM_ADDRESS', ''),
            'reply_to_name' => (string) env('EMAIL_REPLY_TO_NAME', ''),
            'reply_to_address' => (string) env('EMAIL_REPLY_TO_ADDRESS', ''),
            'smtp' => [
                'host' => (string) env('SMTP_HOST', ''),
                'port' => (int) env('SMTP_PORT', 587),
                'encryption' => strtolower(trim((string) (getenv('SMTP_ENCRYPTION') !== false ? getenv('SMTP_ENCRYPTION') : 'tls'))),
                'username' => (string) env('SMTP_USERNAME', ''),
                'password' => (string) env('SMTP_PASSWORD', ''),
                'timeout' => (int) env('SMTP_TIMEOUT', 15),
            ],
        ],
    ];

    if ($config['app_base_path'] !== '' && $config['app_base_path'][0] !== '/') {
        $config['app_base_path'] = '/' . $config['app_base_path'];
    }

    return $config;
}
