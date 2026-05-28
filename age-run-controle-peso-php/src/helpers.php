<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function setupSession(): void
{
    $config = appConfig();
    $basePath = (string) ($config['app_base_path'] ?? '/controle');
    if ($basePath === '' || $basePath[0] !== '/') {
        $basePath = '/controle';
    }
    $rawSessionName = (string) ($config['session_name'] ?? 'age_run_sid');
    $sessionName = preg_replace('/[^A-Za-z0-9_-]/', '_', $rawSessionName) ?: 'age_run_sid';
    if (preg_match('/^[0-9]/', $sessionName)) {
        $sessionName = 's_' . $sessionName;
    }
    session_name($sessionName);

    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

    session_set_cookie_params([
        'lifetime' => 7 * 24 * 60 * 60,
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    // Browsers may keep stale/corrupted cookies; clear invalid IDs to avoid warnings on session_start().
    $incomingId = (string) ($_COOKIE[$sessionName] ?? '');
    if ($incomingId !== '' && !preg_match('/^[A-Za-z0-9,-]{1,128}$/', $incomingId)) {
        unset($_COOKIE[$sessionName]);
        session_id('');
        if (headers_sent() === false) {
            setcookie($sessionName, '', time() - 3600, '/');
        }
    }

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    // Keep a single root-path cookie and actively expire base-path cookie to avoid duplicate-cookie login loops.
    if (headers_sent() === false && session_status() === PHP_SESSION_ACTIVE) {
        $params = session_get_cookie_params();
        $cookieOptions = [
            'expires' => time() + (int) ($params['lifetime'] ?? 0),
            'secure' => (bool) ($params['secure'] ?? false),
            'httponly' => (bool) ($params['httponly'] ?? true),
            'samesite' => (string) ($params['samesite'] ?? 'Lax'),
        ];

        setcookie($sessionName, session_id(), $cookieOptions + ['path' => '/']);
        if ($basePath !== '/' && $basePath !== '') {
            setcookie($sessionName, '', [
                'expires' => time() - 3600,
                'path' => $basePath,
                'secure' => $cookieOptions['secure'],
                'httponly' => $cookieOptions['httponly'],
                'samesite' => $cookieOptions['samesite'],
            ]);
        }
    }
}

function getRequestPath(): string
{
    $config = appConfig();
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $basePath = $config['app_base_path'];

    if ($basePath !== '' && str_starts_with($uriPath, $basePath)) {
        $uriPath = substr($uriPath, strlen($basePath));
        if ($uriPath === '') {
            $uriPath = '/';
        }
    }

    return $uriPath;
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function redirectTo(string $path): never
{
    $basePath = appConfig()['app_base_path'];
    $target = $path;
    if ($basePath !== '' && !str_starts_with($path, $basePath)) {
        $target = $basePath . $path;
    }

    header('Location: ' . $target, true, 302);
    exit;
}

function sendHtml(string $fileName): never
{
    $candidates = [
        dirname(__DIR__) . '/public/' . $fileName,
        dirname(__DIR__) . '/' . $fileName,
    ];

    $path = null;
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            $path = $candidate;
            break;
        }
    }

    if ($path === null) {
        http_response_code(404);
        echo 'Arquivo não encontrado';
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    readfile($path);
    exit;
}

function requireAuth(): int
{
    $userId = $_SESSION['userId'] ?? null;
    if (!$userId) {
        jsonResponse(['error' => 'Não autenticado'], 401);
    }

    return (int) $userId;
}

function parseIntParam(string $value): int
{
    return (int) filter_var($value, FILTER_VALIDATE_INT, ['options' => ['default' => 0]]);
}
