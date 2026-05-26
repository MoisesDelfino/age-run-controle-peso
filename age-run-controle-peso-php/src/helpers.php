<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function setupSession(): void
{
    $config = appConfig();
    session_name($config['session_name']);

    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

    session_set_cookie_params([
        'lifetime' => 7 * 24 * 60 * 60,
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
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
    $path = dirname(__DIR__) . '/public/' . $fileName;
    if (!is_file($path)) {
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
