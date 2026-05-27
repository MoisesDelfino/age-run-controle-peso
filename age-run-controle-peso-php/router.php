<?php
require_once __DIR__ . '/src/config.php';

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$basePath = appConfig()['app_base_path'] ?? '/controle';

$assetPath = $uri;
if ($basePath !== '' && str_starts_with($assetPath, $basePath)) {
    $assetPath = substr($assetPath, strlen($basePath));
    if ($assetPath === '') {
        $assetPath = '/';
    }
}

$file = __DIR__ . '/public' . $assetPath;
if ($assetPath !== '/' && is_file($file)) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mimeMap = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'html' => 'text/html; charset=utf-8',
    ];

    if (isset($mimeMap[$ext])) {
        header('Content-Type: ' . $mimeMap[$ext]);
    }

    readfile($file);
    return true;
}
require __DIR__ . '/public/index.php';
