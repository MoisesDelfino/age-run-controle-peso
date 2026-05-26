<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function enviarCodigoRecuperacao(string $email, string $nome, string $codigo): bool
{
    $config = appConfig();
    $fromAddress = trim((string) $config['email']['from_address']);
    $fromName = trim((string) $config['email']['from_name']);

    if ($fromAddress === '') {
        error_log("[Age Run] Código de recuperação para {$email}: {$codigo}");
        return true;
    }

    $primeiroNome = explode(' ', trim($nome))[0] ?? $nome;
    $subject = 'Codigo de Recuperacao de Senha - Age Run';
    $message = "Olá, {$primeiroNome}!\n\nSeu código de recuperação é: {$codigo}\n\nVálido por 30 minutos.";

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . ($fromName !== '' ? "{$fromName} <{$fromAddress}>" : $fromAddress),
    ];

    return mail($email, $subject, $message, implode("\r\n", $headers));
}
