<?php

declare(strict_types=1);

require_once __DIR__ . '/oauth_polyfill.php';

const GARMIN_CONNECTOR_VERSION = 'pilot-php-1';
const GARMIN_SSO_HEALTH_URL = 'https://sso.garmin.com/';

/**
 * Verifica apenas os pré-requisitos do conector. Não autentica, não envia
 * credenciais e não cria sessão no Garmin Connect.
 */
function garminPilotDiagnostics(): array
{
    $storageRoot = dirname(__DIR__) . '/storage';
    $checks = [
        'php' => version_compare(PHP_VERSION, '8.2.0', '>='),
        'curl' => function_exists('curl_init'),
        'sodium' => function_exists('sodium_crypto_secretbox'),
        'openssl' => function_exists('openssl_encrypt'),
        'oauth_signer' => class_exists('OAuth'),
        'private_storage' => is_dir($storageRoot) && is_writable($storageRoot),
    ];

    $outbound = garminCheckOutboundConnection();
    $checks['garmin_outbound'] = $outbound['ok'];

    return [
        'version' => GARMIN_CONNECTOR_VERSION,
        'ready' => !in_array(false, $checks, true),
        'checks' => $checks,
        'garmin_http_status' => $outbound['status'],
        'garmin_error' => $outbound['error'],
    ];
}

function garminCheckOutboundConnection(): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => null, 'error' => 'cURL indisponível'];
    }

    $handle = curl_init(GARMIN_SSO_HEALTH_URL);
    if ($handle === false) {
        return ['ok' => false, 'status' => null, 'error' => 'Falha ao iniciar cURL'];
    }

    curl_setopt_array($handle, [
        CURLOPT_NOBODY => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_USERAGENT => 'AgeRun-Garmin-Pilot/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $result = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = $result === false ? trim((string) curl_error($handle)) : '';
    curl_close($handle);

    // Qualquer resposta HTTP confirma DNS, TLS e comunicação de saída. O SSO
    // pode responder 3xx/4xx a HEAD sem que isso represente indisponibilidade.
    return [
        'ok' => $result !== false && $status >= 200 && $status < 500,
        'status' => $status > 0 ? $status : null,
        'error' => $error !== '' ? 'Falha de comunicação HTTPS' : null,
    ];
}
