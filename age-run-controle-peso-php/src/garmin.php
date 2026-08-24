<?php

declare(strict_types=1);

require_once __DIR__ . '/oauth_polyfill.php';

const GARMIN_CONNECTOR_VERSION = 'pilot-php-1';
const GARMIN_SSO_HEALTH_URL = 'https://sso.garmin.com/';
const GARMIN_SSO_BASE = 'https://sso.garmin.com/sso';
const GARMIN_CONNECT_OAUTH_BASE = 'https://connectapi.garmin.com/oauth-service/oauth';
const GARMIN_OAUTH_CONSUMER_KEY = 'fc3e99d2-118c-44b8-8ae3-03370dde24c0';
const GARMIN_OAUTH_CONSUMER_SECRET = 'E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF';

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

function garminPilotConnectionFile(int $userId): string
{
    return dirname(__DIR__) . '/storage/garmin/user_' . $userId . '.tokens';
}

function garminPilotIsConnected(int $userId): bool
{
    return is_file(garminPilotConnectionFile($userId));
}

function garminPilotStartLogin(int $userId, string $email, string $password): array
{
    if ($email === '' || $password === '') {
        throw new InvalidArgumentException('Informe o e-mail e a senha do Garmin Connect.');
    }

    $pendingId = bin2hex(random_bytes(16));
    $cookieFile = garminPilotCookieFile($userId, $pendingId);
    garminEnsurePrivateDirectory(dirname($cookieFile));

    try {
        $embedParams = [
            'id' => 'gauth-widget',
            'embedWidget' => 'true',
            'gauthHost' => GARMIN_SSO_BASE,
        ];
        $signinParams = $embedParams + [
            'gauthHost' => GARMIN_SSO_BASE . '/embed',
            'service' => GARMIN_SSO_BASE . '/embed',
            'source' => GARMIN_SSO_BASE . '/embed',
            'redirectAfterAccountLoginUrl' => GARMIN_SSO_BASE . '/embed',
            'redirectAfterAccountCreationUrl' => GARMIN_SSO_BASE . '/embed',
        ];

        $embedUrl = GARMIN_SSO_BASE . '/embed?' . http_build_query($embedParams);
        $signinUrl = GARMIN_SSO_BASE . '/signin?' . http_build_query($signinParams);
        $embed = garminHttpRequest('GET', $embedUrl, [], null, $cookieFile);
        garminRequireHttpSuccess($embed, 'Não foi possível iniciar a sessão Garmin.');

        $signinPage = garminHttpRequest('GET', $signinUrl, ['Referer: ' . $embed['url']], null, $cookieFile);
        garminRequireHttpSuccess($signinPage, 'Não foi possível abrir o login Garmin.');
        $csrf = garminExtractCsrf($signinPage['body']);
        if ($csrf === null) {
            if (garminResponseHasCaptcha($signinPage['body'])) {
                return ['status' => 'captcha_required'];
            }
            throw new RuntimeException('A Garmin alterou a página de autenticação.');
        }

        $login = garminHttpRequest('POST', $signinUrl, [
            'Content-Type: application/x-www-form-urlencoded',
            'Referer: ' . $signinPage['url'],
        ], [
            'username' => $email,
            'password' => $password,
            'embed' => 'true',
            '_csrf' => $csrf,
        ], $cookieFile);

        if (garminResponseHasCaptcha($login['body'])) {
            return ['status' => 'captcha_required'];
        }
        if ($login['status'] === 401 || garminResponseHasInvalidCredentials($login['body'])) {
            return ['status' => 'invalid_credentials'];
        }
        garminRequireHttpSuccess($login, 'A Garmin recusou a tentativa de login.');

        if (garminResponseRequiresMfa($login['body'])) {
            $mfaCsrf = garminExtractCsrf($login['body']);
            if ($mfaCsrf === null) {
                throw new RuntimeException('A Garmin solicitou MFA sem fornecer estado válido.');
            }
            $_SESSION['garmin_pending'] = [
                'id' => $pendingId,
                'email' => $email,
                'csrf' => $mfaCsrf,
                'created_at' => time(),
            ];
            return ['status' => 'mfa_required'];
        }

        $tokens = garminCompleteLogin($login['body']);
        garminSaveEncryptedConnection($userId, $email, $tokens);
        return ['status' => 'connected', 'email' => $email];
    } finally {
        if (empty($_SESSION['garmin_pending']['id']) || $_SESSION['garmin_pending']['id'] !== $pendingId) {
            garminDeleteFile($cookieFile);
        }
    }
}

function garminPilotResumeMfa(int $userId, string $code): array
{
    $pending = $_SESSION['garmin_pending'] ?? null;
    if (!is_array($pending) || time() - (int) ($pending['created_at'] ?? 0) > 600) {
        unset($_SESSION['garmin_pending']);
        throw new RuntimeException('A solicitação MFA expirou. Inicie a conexão novamente.');
    }
    if (!preg_match('/^\d{4,8}$/', $code)) {
        throw new InvalidArgumentException('Informe um código MFA válido.');
    }

    $cookieFile = garminPilotCookieFile($userId, (string) $pending['id']);
    $params = [
        'id' => 'gauth-widget',
        'embedWidget' => 'true',
        'gauthHost' => GARMIN_SSO_BASE . '/embed',
        'service' => GARMIN_SSO_BASE . '/embed',
        'source' => GARMIN_SSO_BASE . '/embed',
        'redirectAfterAccountLoginUrl' => GARMIN_SSO_BASE . '/embed',
        'redirectAfterAccountCreationUrl' => GARMIN_SSO_BASE . '/embed',
    ];
    $url = GARMIN_SSO_BASE . '/verifyMFA/loginEnterMfaCode?' . http_build_query($params);

    try {
        $response = garminHttpRequest('POST', $url, [
            'Content-Type: application/x-www-form-urlencoded',
            'Referer: ' . GARMIN_SSO_BASE . '/signin?' . http_build_query($params),
        ], [
            'mfa-code' => $code,
            'embed' => 'true',
            '_csrf' => (string) $pending['csrf'],
            'fromPage' => 'setupEnterMfaCode',
        ], $cookieFile);
        garminRequireHttpSuccess($response, 'O código MFA foi recusado pela Garmin.');
        $tokens = garminCompleteLogin($response['body']);
        garminSaveEncryptedConnection($userId, (string) $pending['email'], $tokens);
        unset($_SESSION['garmin_pending']);
        return ['status' => 'connected', 'email' => (string) $pending['email']];
    } finally {
        garminDeleteFile($cookieFile);
    }
}

function garminPilotDisconnect(int $userId): void
{
    garminDeleteFile(garminPilotConnectionFile($userId));
    unset($_SESSION['garmin_pending']);
}

function garminCompleteLogin(string $body): array
{
    if (!preg_match('/[?&]ticket=(ST-[^"&\\s<]+)/', html_entity_decode($body), $matches)) {
        throw new RuntimeException('A Garmin não retornou o ticket de autenticação.');
    }
    $ticket = $matches[1];
    $preauthorizedUrl = GARMIN_CONNECT_OAUTH_BASE . '/preauthorized';
    $params = [
        'ticket' => $ticket,
        'login-url' => GARMIN_SSO_BASE . '/embed',
        'accepts-mfa-tokens' => true,
    ];
    $oauth = new OAuth(GARMIN_OAUTH_CONSUMER_KEY, GARMIN_OAUTH_CONSUMER_SECRET);
    $authorization = $oauth->getRequestHeader('GET', $preauthorizedUrl, $params);
    $oauth1Response = garminHttpRequest('GET', $preauthorizedUrl . '?' . http_build_query($params), [
        'Authorization: ' . $authorization,
        'User-Agent: com.garmin.android.apps.connectmobile',
    ]);
    garminRequireHttpSuccess($oauth1Response, 'Falha na primeira troca de tokens Garmin.');
    parse_str($oauth1Response['body'], $oauth1);
    if (empty($oauth1['oauth_token']) || empty($oauth1['oauth_token_secret'])) {
        throw new RuntimeException('A Garmin retornou um token intermediário inválido.');
    }

    $exchangeUrl = GARMIN_CONNECT_OAUTH_BASE . '/exchange/user/2.0';
    $oauth->setToken((string) $oauth1['oauth_token'], (string) $oauth1['oauth_token_secret']);
    $exchangeAuthorization = $oauth->getRequestHeader('POST', $exchangeUrl);
    $oauth2Response = garminHttpRequest('POST', $exchangeUrl, [
        'Authorization: ' . $exchangeAuthorization,
        'User-Agent: com.garmin.android.apps.connectmobile',
        'Content-Type: application/x-www-form-urlencoded',
    ], []);
    garminRequireHttpSuccess($oauth2Response, 'Falha na troca final de tokens Garmin.');
    $oauth2 = json_decode($oauth2Response['body'], true);
    if (!is_array($oauth2) || empty($oauth2['access_token'])) {
        throw new RuntimeException('A Garmin retornou uma sessão inválida.');
    }

    return ['oauth1' => $oauth1, 'oauth2' => $oauth2];
}

function garminHttpRequest(string $method, string $url, array $headers = [], ?array $form = null, ?string $cookieFile = null): array
{
    $handle = curl_init($url);
    if ($handle === false) {
        throw new RuntimeException('Falha ao iniciar comunicação com a Garmin.');
    }
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 8,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($cookieFile !== null) {
        curl_setopt($handle, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($handle, CURLOPT_COOKIEFILE, $cookieFile);
    }
    if (strtoupper($method) === 'POST') {
        curl_setopt($handle, CURLOPT_POST, true);
        curl_setopt($handle, CURLOPT_POSTFIELDS, http_build_query($form ?? []));
    }
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $effectiveUrl = (string) curl_getinfo($handle, CURLINFO_EFFECTIVE_URL);
    $error = $body === false ? curl_error($handle) : '';
    curl_close($handle);
    if ($body === false) {
        throw new RuntimeException('Falha HTTPS ao acessar a Garmin' . ($error !== '' ? ': ' . $error : '.'));
    }
    return ['status' => $status, 'body' => $body, 'url' => $effectiveUrl ?: $url];
}

function garminRequireHttpSuccess(array $response, string $message): void
{
    $status = (int) ($response['status'] ?? 0);
    if ($status < 200 || $status >= 400) {
        throw new RuntimeException($message . ' HTTP ' . $status . '.');
    }
}

function garminExtractCsrf(string $body): ?string
{
    foreach ([
        '/name=["\']_csrf["\'][^>]*value=["\']([^"\']+)["\']/i',
        '/value=["\']([^"\']+)["\'][^>]*name=["\']_csrf["\']/i',
    ] as $pattern) {
        if (preg_match($pattern, $body, $match)) {
            return html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }
    }
    return null;
}

function garminResponseHasCaptcha(string $body): bool
{
    $value = strtolower($body);
    return str_contains($value, 'g-recaptcha') || str_contains($value, 'recaptcha') || str_contains($value, 'captcha');
}

function garminResponseHasInvalidCredentials(string $body): bool
{
    $value = strtolower(strip_tags($body));
    return str_contains($value, 'incorrect username or password')
        || str_contains($value, 'invalid username or password')
        || str_contains($value, 'endereço de e-mail ou palavra-passe incorretos');
}

function garminResponseRequiresMfa(string $body): bool
{
    return stripos($body, '<title>MFA') !== false
        || stripos($body, 'loginEnterMfaCode') !== false
        || stripos($body, 'mfa-code') !== false;
}

function garminPilotCookieFile(int $userId, string $pendingId): string
{
    return dirname(__DIR__) . '/storage/garmin/pending_' . $userId . '_' . $pendingId . '.cookie';
}

function garminEnsurePrivateDirectory(string $directory): void
{
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Não foi possível preparar o armazenamento privado Garmin.');
    }
}

function garminSaveEncryptedConnection(int $userId, string $email, array $tokens): void
{
    $config = appConfig();
    $secret = (string) ($config['session_secret'] ?? '');
    if (strlen($secret) < 16) {
        throw new RuntimeException('SESSION_SECRET precisa ser configurado antes de armazenar tokens Garmin.');
    }
    $payload = json_encode(['email' => $email, 'tokens' => $tokens, 'saved_at' => time()], JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        throw new RuntimeException('Não foi possível preparar os tokens Garmin.');
    }
    $key = hash('sha256', 'age-run-garmin|' . $secret, true);
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $encrypted = sodium_crypto_secretbox($payload, $nonce, $key);
    $directory = dirname(garminPilotConnectionFile($userId));
    garminEnsurePrivateDirectory($directory);
    $file = garminPilotConnectionFile($userId);
    $temporary = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($temporary, base64_encode($nonce . $encrypted), LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível salvar a sessão Garmin.');
    }
    @chmod($temporary, 0600);
    if (!rename($temporary, $file)) {
        garminDeleteFile($temporary);
        throw new RuntimeException('Não foi possível concluir o armazenamento da sessão Garmin.');
    }
}

function garminDeleteFile(string $file): void
{
    if (is_file($file)) {
        @unlink($file);
    }
}
