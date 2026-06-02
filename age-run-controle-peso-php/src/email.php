<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

function emailEncodeHeader(string $value): string
{
    if ($value === '') {
        return '';
    }

    if (preg_match('/^[\x20-\x7E]+$/', $value) === 1) {
        return $value;
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function emailDotStuff(string $message): string
{
    $normalized = str_replace(["\r\n", "\r"], "\n", $message);
    $normalized = preg_replace('/^\./m', '..', $normalized);
    return str_replace("\n", "\r\n", $normalized);
}

function emailReadSmtpResponse($socket): string
{
    $response = '';

    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }

        $response .= $line;
        if (preg_match('/^\d{3} /', $line) === 1) {
            break;
        }
    }

    return trim($response);
}

function emailExpectSmtpCode($socket, array $expectedCodes, string $context): string
{
    $response = emailReadSmtpResponse($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException("SMTP {$context} falhou: {$response}");
    }

    return $response;
}

function emailSendSmtpCommand($socket, string $command, array $expectedCodes, string $context): string
{
    if (@fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException("SMTP {$context} falhou ao enviar comando");
    }

    return emailExpectSmtpCode($socket, $expectedCodes, $context);
}

function emailBuildHeaders(string $to, string $subject, array $config): array
{
    $fromAddress = trim((string) ($config['from_address'] ?? ''));
    $fromName = trim((string) ($config['from_name'] ?? ''));
    $replyToAddress = trim((string) ($config['reply_to_address'] ?? ''));
    $replyToName = trim((string) ($config['reply_to_name'] ?? ''));

    $headers = [
        'Date: ' . date(DATE_RFC2822),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'To: ' . $to,
        'Subject: ' . emailEncodeHeader($subject),
        'From: ' . ($fromName !== '' ? emailEncodeHeader($fromName) . " <{$fromAddress}>" : $fromAddress),
    ];

    if ($replyToAddress !== '') {
        $headers[] = 'Reply-To: ' . ($replyToName !== '' ? emailEncodeHeader($replyToName) . " <{$replyToAddress}>" : $replyToAddress);
    }

    return $headers;
}

function emailBuildMailHeaders(array $config): array
{
    $fromAddress = trim((string) ($config['from_address'] ?? ''));
    $fromName = trim((string) ($config['from_name'] ?? ''));
    $replyToAddress = trim((string) ($config['reply_to_address'] ?? ''));
    $replyToName = trim((string) ($config['reply_to_name'] ?? ''));

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'From: ' . ($fromName !== '' ? emailEncodeHeader($fromName) . " <{$fromAddress}>" : $fromAddress),
    ];

    if ($replyToAddress !== '') {
        $headers[] = 'Reply-To: ' . ($replyToName !== '' ? emailEncodeHeader($replyToName) . " <{$replyToAddress}>" : $replyToAddress);
    }

    return $headers;
}

function sendEmailViaSmtp(string $to, string $subject, string $message, array $config): bool
{
    $smtp = (array) ($config['smtp'] ?? []);
    $host = trim((string) ($smtp['host'] ?? ''));
    $port = (int) ($smtp['port'] ?? 587);
    $encryption = strtolower(trim((string) ($smtp['encryption'] ?? 'tls')));
    $username = trim((string) ($smtp['username'] ?? ''));
    $password = (string) ($smtp['password'] ?? '');
    $timeout = max(5, (int) ($smtp['timeout'] ?? 15));
    $fromAddress = trim((string) ($config['from_address'] ?? ''));
    $ehloHost = preg_replace('/[^a-z0-9.-]/i', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost')) ?: 'localhost';

    if ($host === '' || $fromAddress === '') {
        error_log('[Age Run] SMTP não configurado: host ou remetente ausente');
        return false;
    }

    $remoteHost = $encryption === 'ssl' ? 'ssl://' . $host : $host;
    $socket = @fsockopen($remoteHost, $port, $errorNumber, $errorMessage, $timeout);
    if (!$socket) {
        error_log("[Age Run] Falha ao conectar SMTP {$host}:{$port} - {$errorMessage} ({$errorNumber})");
        return false;
    }

    stream_set_timeout($socket, $timeout);

    try {
        emailExpectSmtpCode($socket, [220], 'connect');
        emailSendSmtpCommand($socket, 'EHLO ' . $ehloHost, [250], 'EHLO');

        if ($encryption === 'tls') {
            emailSendSmtpCommand($socket, 'STARTTLS', [220], 'STARTTLS');
            $cryptoEnabled = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($cryptoEnabled !== true) {
                throw new RuntimeException('SMTP STARTTLS não pôde ser estabelecido');
            }
            emailSendSmtpCommand($socket, 'EHLO ' . $ehloHost, [250], 'EHLO pós-TLS');
        }

        if ($username !== '') {
            emailSendSmtpCommand($socket, 'AUTH LOGIN', [334], 'AUTH LOGIN');
            emailSendSmtpCommand($socket, base64_encode($username), [334], 'AUTH username');
            emailSendSmtpCommand($socket, base64_encode($password), [235], 'AUTH password');
        }

        emailSendSmtpCommand($socket, 'MAIL FROM:<' . $fromAddress . '>', [250], 'MAIL FROM');
        emailSendSmtpCommand($socket, 'RCPT TO:<' . $to . '>', [250, 251], 'RCPT TO');
        emailSendSmtpCommand($socket, 'DATA', [354], 'DATA');

        $payload = implode("\r\n", emailBuildHeaders($to, $subject, $config)) . "\r\n\r\n" . emailDotStuff($message) . "\r\n.";
        emailSendSmtpCommand($socket, $payload, [250], 'envio da mensagem');
        emailSendSmtpCommand($socket, 'QUIT', [221], 'QUIT');

        return true;
    } catch (Throwable $e) {
        error_log('[Age Run] Falha SMTP: ' . $e->getMessage());
        return false;
    } finally {
        fclose($socket);
    }
}

function sendAppEmail(string $email, string $subject, string $message): bool
{
    $config = appConfig()['email'] ?? [];
    $to = trim($email);
    $transport = strtolower(trim((string) ($config['transport'] ?? 'mail')));
    $fromAddress = trim((string) ($config['from_address'] ?? ''));

    if ($to === '') {
        return false;
    }

    if ($fromAddress === '') {
        error_log("[Age Run] E-mail não configurado. Destino={$to} Assunto={$subject} Conteúdo={$message}");
        return false;
    }

    if ($transport === 'smtp') {
        return sendEmailViaSmtp($to, $subject, $message, $config);
    }

    return mail($to, $subject, $message, implode("\r\n", emailBuildMailHeaders($config)));
}

function enviarCodigoRecuperacao(string $email, string $nome, string $codigo): bool
{
    $primeiroNome = explode(' ', trim($nome))[0] ?? $nome;
    $subject = 'Codigo de Recuperacao de Senha - Age Run';
    $message = "Olá, {$primeiroNome}!\n\nSeu código de recuperação é: {$codigo}\n\nVálido por 30 minutos.";

    $ok = sendAppEmail($email, $subject, $message);
    if (!$ok) {
        error_log("[Age Run] Código de recuperação para {$email}: {$codigo}");
    }

    return $ok;
}

function enviarEmailConfirmacaoCadastro(string $email, string $nome, string $token): bool
{
    $primeiroNome = explode(' ', trim($nome))[0] ?? $nome;
    $link = appAbsoluteUrl('/confirmar-email', ['token' => $token]);
    $subject = 'Confirme seu cadastro - Age Run';
    $message = "Olá, {$primeiroNome}!\n\nPara ativar sua conta no Age Run, confirme seu e-mail no link abaixo:\n{$link}\n\nEste link é válido por 24 horas.\n\nSe você não solicitou este cadastro, ignore esta mensagem.";

    $ok = sendAppEmail($email, $subject, $message);
    if (!$ok) {
        error_log("[Age Run] Link de confirmação para {$email}: {$link}");
    }

    return $ok;
}
