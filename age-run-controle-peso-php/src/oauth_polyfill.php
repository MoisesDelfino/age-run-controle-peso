<?php

declare(strict_types=1);

/**
 * Implementação mínima da API usada por sportlog/garmin-connect quando a
 * extensão PECL OAuth não está disponível no servidor.
 */
if (!class_exists('OAuth')) {
    final class OAuth
    {
        private ?string $token = null;
        private ?string $tokenSecret = null;

        public function __construct(
            private readonly string $consumerKey,
            private readonly string $consumerSecret
        ) {
        }

        public function setToken(string $token, string $tokenSecret): bool
        {
            $this->token = $token;
            $this->tokenSecret = $tokenSecret;
            return true;
        }

        public function getRequestHeader(string $method, string $url, mixed $extraParameters = null): string
        {
            $oauthParameters = [
                'oauth_consumer_key' => $this->consumerKey,
                'oauth_nonce' => bin2hex(random_bytes(16)),
                'oauth_signature_method' => 'HMAC-SHA1',
                'oauth_timestamp' => (string) time(),
                'oauth_version' => '1.0',
            ];

            if ($this->token !== null && $this->token !== '') {
                $oauthParameters['oauth_token'] = $this->token;
            }

            $signatureParameters = $oauthParameters;
            $query = parse_url($url, PHP_URL_QUERY);
            if (is_string($query) && $query !== '') {
                parse_str($query, $queryParameters);
                $signatureParameters = array_merge($signatureParameters, $queryParameters);
            }
            if (is_array($extraParameters)) {
                $signatureParameters = array_merge($signatureParameters, $extraParameters);
            }

            $normalized = self::normalizeParameters($signatureParameters);
            $baseUrl = self::baseUrl($url);
            $signatureBase = strtoupper($method)
                . '&' . rawurlencode($baseUrl)
                . '&' . rawurlencode($normalized);
            $signingKey = rawurlencode($this->consumerSecret)
                . '&' . rawurlencode($this->tokenSecret ?? '');

            $oauthParameters['oauth_signature'] = base64_encode(
                hash_hmac('sha1', $signatureBase, $signingKey, true)
            );

            ksort($oauthParameters, SORT_STRING);
            $header = array_map(
                static fn (string $key, string $value): string => rawurlencode($key) . '="' . rawurlencode($value) . '"',
                array_keys($oauthParameters),
                array_values($oauthParameters)
            );

            return 'OAuth ' . implode(', ', $header);
        }

        private static function normalizeParameters(array $parameters): string
        {
            $pairs = [];
            foreach ($parameters as $key => $value) {
                if (is_array($value)) {
                    foreach ($value as $item) {
                        $pairs[] = [rawurlencode((string) $key), rawurlencode((string) $item)];
                    }
                    continue;
                }
                $pairs[] = [rawurlencode((string) $key), rawurlencode(self::scalarValue($value))];
            }

            usort($pairs, static fn (array $left, array $right): int => $left <=> $right);
            return implode('&', array_map(
                static fn (array $pair): string => $pair[0] . '=' . $pair[1],
                $pairs
            ));
        }

        private static function scalarValue(mixed $value): string
        {
            if (is_bool($value)) {
                return $value ? '1' : '0';
            }
            return (string) $value;
        }

        private static function baseUrl(string $url): string
        {
            $parts = parse_url($url);
            if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
                throw new InvalidArgumentException('URL OAuth inválida.');
            }

            $scheme = strtolower((string) $parts['scheme']);
            $host = strtolower((string) $parts['host']);
            $port = isset($parts['port']) ? (int) $parts['port'] : null;
            $includePort = $port !== null
                && !(($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443));

            return $scheme . '://' . $host
                . ($includePort ? ':' . $port : '')
                . ((string) ($parts['path'] ?? '/'));
        }
    }
}
