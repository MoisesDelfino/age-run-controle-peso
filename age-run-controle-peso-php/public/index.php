<?php

declare(strict_types=1);

$candidates = [
	__DIR__ . '/src/app.php',
	dirname(__DIR__) . '/src/app.php',
];

foreach ($candidates as $file) {
	if (is_file($file)) {
		require_once $file;
		return;
	}
}

http_response_code(500);
header('Content-Type: text/plain; charset=utf-8');
echo 'Erro de inicializacao: src/app.php nao encontrado.';
