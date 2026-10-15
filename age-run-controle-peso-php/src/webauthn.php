<?php

declare(strict_types=1);

function webauthnBase64UrlEncode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function webauthnBase64UrlDecode(string $value): string
{
    $padding = (4 - strlen($value) % 4) % 4;
    $decoded = base64_decode(strtr($value . str_repeat('=', $padding), '-_', '+/'), true);
    if ($decoded === false) {
        throw new RuntimeException('Dados de autenticação inválidos.');
    }
    return $decoded;
}

function webauthnRpId(): string
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    return preg_replace('/:\d+$/', '', $host) ?: 'localhost';
}

function webauthnOrigin(): string
{
    $forwarded = strtolower(trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
    $scheme = $forwarded !== '' ? $forwarded : (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http');
    return $scheme . '://' . (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function webauthnEnsureTable(): void
{
    $driver = strtolower((string) (appConfig()['db']['driver'] ?? 'mysql'));
    if ($driver === 'sqlite') {
        dbExecute('CREATE TABLE IF NOT EXISTS webauthn_credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER NOT NULL, credential_id TEXT NOT NULL UNIQUE, public_key_cose TEXT NOT NULL, sign_count INTEGER DEFAULT 0, transports TEXT NULL, nome TEXT NULL, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP, ultimo_uso_em DATETIME NULL)');
        return;
    }
    if (in_array($driver, ['pgsql', 'postgres', 'postgresql'], true)) {
        dbExecute('CREATE TABLE IF NOT EXISTS webauthn_credentials (id BIGSERIAL PRIMARY KEY, usuario_id BIGINT NOT NULL, credential_id TEXT NOT NULL UNIQUE, public_key_cose TEXT NOT NULL, sign_count BIGINT DEFAULT 0, transports TEXT NULL, nome TEXT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ultimo_uso_em TIMESTAMP NULL)');
        return;
    }
    dbExecute('CREATE TABLE IF NOT EXISTS webauthn_credentials (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, usuario_id BIGINT NOT NULL, credential_id VARBINARY(1024) NOT NULL UNIQUE, public_key_cose TEXT NOT NULL, sign_count BIGINT UNSIGNED DEFAULT 0, transports TEXT NULL, nome VARCHAR(120) NULL, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP, ultimo_uso_em DATETIME NULL, INDEX idx_webauthn_usuario (usuario_id))');
}

function webauthnReadLength(string $data, int &$offset, int $additional): int
{
    if ($additional < 24) return $additional;
    $sizes = [24 => 1, 25 => 2, 26 => 4, 27 => 8];
    if (!isset($sizes[$additional])) throw new RuntimeException('CBOR não suportado.');
    $size = $sizes[$additional];
    $chunk = substr($data, $offset, $size);
    if (strlen($chunk) !== $size) throw new RuntimeException('CBOR incompleto.');
    $offset += $size;
    $value = 0;
    for ($i = 0; $i < $size; $i++) $value = ($value * 256) + ord($chunk[$i]);
    return $value;
}

function webauthnCborDecode(string $data, int &$offset = 0)
{
    if ($offset >= strlen($data)) throw new RuntimeException('CBOR vazio.');
    $initial = ord($data[$offset++]);
    $major = $initial >> 5;
    $additional = $initial & 31;
    $length = webauthnReadLength($data, $offset, $additional);
    if ($major === 0) return $length;
    if ($major === 1) return -1 - $length;
    if ($major === 2 || $major === 3) {
        $value = substr($data, $offset, $length);
        if (strlen($value) !== $length) throw new RuntimeException('CBOR incompleto.');
        $offset += $length;
        return $value;
    }
    if ($major === 4) {
        $value = [];
        for ($i = 0; $i < $length; $i++) $value[] = webauthnCborDecode($data, $offset);
        return $value;
    }
    if ($major === 5) {
        $value = [];
        for ($i = 0; $i < $length; $i++) {
            $key = webauthnCborDecode($data, $offset);
            $value[$key] = webauthnCborDecode($data, $offset);
        }
        return $value;
    }
    if ($major === 7 && $additional === 20) return false;
    if ($major === 7 && $additional === 21) return true;
    if ($major === 7 && $additional === 22) return null;
    throw new RuntimeException('Tipo CBOR não suportado.');
}

function webauthnValidateClientData(array $payload, string $expectedType, string $sessionKey): string
{
    $raw = webauthnBase64UrlDecode((string) ($payload['clientDataJSON'] ?? ''));
    $client = json_decode($raw, true);
    $challenge = $_SESSION[$sessionKey]['challenge'] ?? '';
    $createdAt = (int) ($_SESSION[$sessionKey]['created_at'] ?? 0);
    unset($_SESSION[$sessionKey]);
    if (!is_array($client) || ($client['type'] ?? '') !== $expectedType) throw new RuntimeException('Resposta de autenticação inválida.');
    if ($challenge === '' || time() - $createdAt > 300 || !hash_equals($challenge, (string) ($client['challenge'] ?? ''))) throw new RuntimeException('A solicitação expirou. Tente novamente.');
    if (!hash_equals(webauthnOrigin(), (string) ($client['origin'] ?? ''))) throw new RuntimeException('Origem de autenticação inválida.');
    return $raw;
}

function webauthnParseAuthData(string $authData, bool $registration): array
{
    if (strlen($authData) < 37) throw new RuntimeException('Dados do autenticador incompletos.');
    if (!hash_equals(hash('sha256', webauthnRpId(), true), substr($authData, 0, 32))) throw new RuntimeException('Este acesso não pertence ao domínio da Age Run.');
    $flags = ord($authData[32]);
    if (($flags & 0x01) === 0 || ($flags & 0x04) === 0) throw new RuntimeException('Confirme sua identidade no aparelho.');
    $counter = unpack('N', substr($authData, 33, 4))[1];
    $result = ['flags' => $flags, 'counter' => $counter];
    if (!$registration) return $result;
    if (($flags & 0x40) === 0 || strlen($authData) < 55) throw new RuntimeException('A credencial criada é inválida.');
    $credentialLength = unpack('n', substr($authData, 53, 2))[1];
    $credentialId = substr($authData, 55, $credentialLength);
    $coseOffset = 55 + $credentialLength;
    $offset = $coseOffset;
    webauthnCborDecode($authData, $offset);
    $result['credential_id'] = $credentialId;
    $result['public_key_cose'] = substr($authData, $coseOffset, $offset - $coseOffset);
    return $result;
}

function webauthnCoseToPem(string $cose): string
{
    $offset = 0;
    $key = webauthnCborDecode($cose, $offset);
    if (!is_array($key) || ($key[1] ?? null) !== 2 || ($key[3] ?? null) !== -7 || ($key[-1] ?? null) !== 1) throw new RuntimeException('Tipo de chave não suportado.');
    $x = $key[-2] ?? '';
    $y = $key[-3] ?? '';
    if (!is_string($x) || !is_string($y) || strlen($x) !== 32 || strlen($y) !== 32) throw new RuntimeException('Chave pública inválida.');
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $x . $y;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

function webauthnNewChallenge(string $sessionKey): string
{
    $challenge = webauthnBase64UrlEncode(random_bytes(32));
    $_SESSION[$sessionKey] = ['challenge' => $challenge, 'created_at' => time()];
    return $challenge;
}

