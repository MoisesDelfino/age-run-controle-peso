<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/email.php';

set_exception_handler(static function (Throwable $e): void {
    $cfg = appConfig();
    $isDebug = ($cfg['app_env'] ?? 'production') !== 'production';
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $isApi = str_contains($uriPath, '/api/');

    error_log('[AgeRun PHP] Unhandled exception: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());

    if ($isApi || str_contains($accept, 'application/json')) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        $payload = ['error' => 'Erro interno do servidor'];
        if ($isDebug) {
            $payload['debug'] = $e->getMessage();
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return;
    }

    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo $isDebug ? ('Erro interno do servidor: ' . $e->getMessage()) : 'Erro interno do servidor';
});

setupSession();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = getRequestPath();

if ($method === 'POST' && $path === '/api/auth/cadastro') {
    $input = jsonInput();
    $nome = trim((string) ($input['nome'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $senha = (string) ($input['senha'] ?? '');
    $sexo = strtolower(trim((string) ($input['sexo'] ?? '')));

    if ($nome === '' || $email === '' || $senha === '' || $sexo === '') {
        jsonResponse(['error' => 'Todos os campos são obrigatórios'], 400);
    }

    if (!in_array($sexo, ['masculino', 'feminino'], true)) {
        jsonResponse(['error' => 'Sexo inválido'], 400);
    }

    try {
        dbExecute(
            'INSERT INTO usuarios (nome, email, senha, sexo) VALUES (:nome, :email, :senha, :sexo)',
            [
                ':nome' => $nome,
                ':email' => $email,
                ':senha' => password_hash($senha, PASSWORD_DEFAULT),
                ':sexo' => $sexo,
            ]
        );
        $userId = dbLastInsertId();
    } catch (PDOException $e) {
        if (($e->getCode() ?? '') === '23000') {
            jsonResponse(['error' => 'E-mail já cadastrado'], 400);
        }
        jsonResponse(['error' => 'Erro ao cadastrar usuário'], 500);
    }

    $_SESSION['userId'] = $userId;
    $_SESSION['nome'] = $nome;
    $_SESSION['sexo'] = $sexo;

    jsonResponse([
        'success' => true,
        'message' => 'Cadastro realizado com sucesso!',
        'usuario' => ['id' => $userId, 'nome' => $nome, 'email' => $email, 'sexo' => $sexo],
    ]);
}

if ($method === 'POST' && $path === '/api/auth/login') {
    try {
        $input = jsonInput();
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $senha = (string) ($input['senha'] ?? '');

        if ($email === '' || $senha === '') {
            jsonResponse(['error' => 'E-mail e senha são obrigatórios'], 400);
        }

        $usuario = dbFetchOne('SELECT * FROM usuarios WHERE email = :email LIMIT 1', [':email' => $email]);
        if (!$usuario || !password_verify($senha, (string) ($usuario['senha'] ?? ''))) {
            jsonResponse(['error' => 'E-mail ou senha incorretos'], 401);
        }

        $_SESSION['userId'] = (int) $usuario['id'];
        $_SESSION['nome'] = (string) $usuario['nome'];
        $_SESSION['sexo'] = (string) ($usuario['sexo'] ?? 'masculino');

        jsonResponse([
            'success' => true,
            'message' => 'Login realizado com sucesso!',
            'usuario' => [
                'id' => (int) $usuario['id'],
                'nome' => (string) $usuario['nome'],
                'email' => (string) $usuario['email'],
                'sexo' => (string) ($usuario['sexo'] ?? 'masculino'),
            ],
        ]);
    } catch (Throwable $e) {
        error_log('[AgeRun PHP] Erro no login: ' . $e->getMessage());
        $cfg = appConfig();
        $isDebug = ($cfg['app_env'] ?? 'production') !== 'production';
        $payload = ['error' => 'Erro interno do servidor'];
        if ($isDebug) {
            $payload['debug'] = $e->getMessage();
        }
        jsonResponse($payload, 500);
    }
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logout realizado']);
}

if ($method === 'GET' && $path === '/api/auth/session') {
    $userId = (int) ($_SESSION['userId'] ?? 0);
    if (!$userId) {
        jsonResponse(['authenticated' => false]);
    }

    try {
        $usuario = dbFetchOne(
            'SELECT id, nome, email, altura, sexo, perfil FROM usuarios WHERE id = :id LIMIT 1',
            [':id' => $userId]
        );
    } catch (PDOException) {
        $usuario = dbFetchOne('SELECT id, nome, email FROM usuarios WHERE id = :id LIMIT 1', [':id' => $userId]);
        if ($usuario) {
            $usuario['altura'] = null;
            $usuario['sexo'] = 'masculino';
            $usuario['perfil'] = 'aluno';
        }
    }

    if (!$usuario) {
        jsonResponse(['authenticated' => false]);
    }

    $usuario['altura'] = $usuario['altura'] ?? null;
    $usuario['sexo'] = $usuario['sexo'] ?? 'masculino';
    $usuario['perfil'] = $usuario['perfil'] ?? 'aluno';
    $usuario['authenticated'] = true;
    jsonResponse($usuario);
}

if ($method === 'POST' && $path === '/api/auth/solicitar-recuperacao') {
    $input = jsonInput();
    $email = strtolower(trim((string) ($input['email'] ?? '')));

    if ($email === '') {
        jsonResponse(['error' => 'E-mail é obrigatório'], 400);
    }

    $usuario = dbFetchOne('SELECT id, nome, email FROM usuarios WHERE email = :email LIMIT 1', [':email' => $email]);
    if (!$usuario) {
        jsonResponse(['error' => 'E-mail não cadastrado'], 404);
    }

    $codigo = (string) random_int(100000, 999999);
    $expiracao = (new DateTimeImmutable('+30 minutes'))->format('Y-m-d H:i:s');

    dbExecute(
        'UPDATE usuarios SET codigo_recuperacao = :codigo, codigo_expiracao = :expiracao WHERE id = :id',
        [':codigo' => $codigo, ':expiracao' => $expiracao, ':id' => (int) $usuario['id']]
    );

    $ok = enviarCodigoRecuperacao((string) $usuario['email'], (string) $usuario['nome'], $codigo);

    if ($ok) {
        jsonResponse(['success' => true, 'message' => 'Código enviado para seu e-mail com sucesso!']);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Código gerado. Verifique o console do servidor.',
        'warning' => 'Serviço de e-mail não configurado',
    ]);
}

if ($method === 'POST' && $path === '/api/auth/redefinir-senha') {
    $input = jsonInput();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $codigo = trim((string) ($input['codigo'] ?? ''));
    $novaSenha = (string) ($input['novaSenha'] ?? '');

    if ($email === '' || $codigo === '' || $novaSenha === '') {
        jsonResponse(['error' => 'Todos os campos são obrigatórios'], 400);
    }

    if (mb_strlen($novaSenha) < 6) {
        jsonResponse(['error' => 'A senha deve ter no mínimo 6 caracteres'], 400);
    }

    $usuario = dbFetchOne(
        'SELECT id, codigo_recuperacao, codigo_expiracao FROM usuarios WHERE email = :email LIMIT 1',
        [':email' => $email]
    );

    if (!$usuario) {
        jsonResponse(['error' => 'E-mail não encontrado'], 404);
    }

    if (empty($usuario['codigo_recuperacao'])) {
        jsonResponse(['error' => 'Nenhum código de recuperação foi solicitado'], 400);
    }

    if ((string) $usuario['codigo_recuperacao'] !== $codigo) {
        jsonResponse(['error' => 'Código inválido'], 400);
    }

    $agora = new DateTimeImmutable('now');
    $expiracao = new DateTimeImmutable((string) $usuario['codigo_expiracao']);
    if ($agora > $expiracao) {
        jsonResponse(['error' => 'Código expirado. Solicite um novo código'], 400);
    }

    dbExecute(
        'UPDATE usuarios SET senha = :senha, codigo_recuperacao = NULL, codigo_expiracao = NULL WHERE id = :id',
        [':senha' => password_hash($novaSenha, PASSWORD_DEFAULT), ':id' => (int) $usuario['id']]
    );

    jsonResponse(['success' => true, 'message' => 'Senha redefinida com sucesso']);
}

if ($method === 'POST' && $path === '/api/pesagens') {
    $usuarioId = requireAuth();
    $input = jsonInput();

    $peso = (float) ($input['peso'] ?? 0);
    if ($peso <= 0) {
        jsonResponse(['error' => 'Peso inválido'], 400);
    }

    $campos = ['usuario_id', 'peso'];
    $placeholders = [':usuario_id', ':peso'];
    $params = [':usuario_id' => $usuarioId, ':peso' => $peso];

    if (!empty($input['data_pesagem'])) {
        $campos[] = 'data_pesagem';
        $placeholders[] = ':data_pesagem';
        $params[':data_pesagem'] = (string) $input['data_pesagem'];
    }

    $bioCampos = [
        'gordura_percentual',
        'massa_muscular_percentual',
        'agua_percentual',
        'massa_ossea',
        'metabolismo_basal',
        'idade_metabolica',
        'gordura_visceral',
    ];

    foreach ($bioCampos as $campo) {
        if (!array_key_exists($campo, $input)) {
            continue;
        }

        $valorRaw = $input[$campo];
        if ($valorRaw === null || $valorRaw === '') {
            continue;
        }

        $campos[] = $campo;
        $placeholders[] = ':' . $campo;
        $params[':' . $campo] = is_numeric($valorRaw) ? (float) $valorRaw : null;
    }

    $sql = sprintf(
        'INSERT INTO pesagens (%s) VALUES (%s)',
        implode(', ', $campos),
        implode(', ', $placeholders)
    );

    dbExecute($sql, $params);
    $id = dbLastInsertId();

    jsonResponse([
        'id' => $id,
        'usuario_id' => $usuarioId,
        'peso' => $peso,
        'message' => 'Pesagem registrada com sucesso!',
    ]);
}

if ($method === 'GET' && $path === '/api/ranking') {
    $usuarioId = requireAuth();

    $perfil = dbFetchOne('SELECT sexo FROM usuarios WHERE id = :id LIMIT 1', [':id' => $usuarioId]);
    if (!$perfil) {
        jsonResponse(['error' => 'Erro ao validar perfil de acesso'], 500);
    }

    if (strtolower((string) ($perfil['sexo'] ?? '')) === 'feminino') {
        jsonResponse([
            'error' => 'Ranking geral indisponível para este perfil',
            'code' => 'RANKING_RESTRITO',
        ], 403);
    }

    try {
        $rows = dbFetchAll(
            'SELECT
                u.id AS usuario_id,
                u.nome,
                (SELECT peso FROM pesagens WHERE usuario_id = u.id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem ASC LIMIT 1) AS peso_inicial,
                (SELECT peso FROM pesagens WHERE usuario_id = u.id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC LIMIT 1) AS peso_atual,
                COUNT(p.id) AS total_pesagens
             FROM usuarios u
             LEFT JOIN pesagens p ON u.id = p.usuario_id AND (p.excluido IS NULL OR p.excluido = 0)
             GROUP BY u.id, u.nome
             HAVING COUNT(p.id) > 0'
        );
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar ranking'], 500);
    }

    $ranking = [];
    foreach ($rows as $row) {
        $pesoInicial = (float) $row['peso_inicial'];
        $pesoAtual = (float) $row['peso_atual'];
        $diferenca = round($pesoAtual - $pesoInicial, 2);
        $percentualPerda = $pesoInicial > 0 ? round((($pesoInicial - $pesoAtual) / $pesoInicial) * 100, 2) : 0.0;

        $row['diferenca'] = $diferenca;
        $row['percentual_perda'] = $percentualPerda;
        $ranking[] = $row;
    }

    usort($ranking, static fn(array $a, array $b): int => ($b['percentual_perda'] <=> $a['percentual_perda']));
    foreach ($ranking as $index => &$item) {
        $item['posicao'] = $index + 1;
    }
    unset($item);

    jsonResponse(['ranking' => $ranking]);
}

if ($method === 'GET' && preg_match('#^/api/pesagens/usuario/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $targetId = (int) $matches[1];

    if ($usuarioId !== $targetId) {
        jsonResponse(['error' => 'Acesso negado'], 403);
    }

    try {
        $pesagens = dbFetchAll(
            'SELECT * FROM pesagens WHERE usuario_id = :usuario_id AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC',
            [':usuario_id' => $targetId]
        );
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar histórico'], 500);
    }

    jsonResponse(['pesagens' => $pesagens]);
}

if ($method === 'GET' && $path === '/api/meu-historico') {
    $usuarioId = requireAuth();
    $rows = dbFetchAll(
        'SELECT * FROM pesagens WHERE usuario_id = :usuario_id ORDER BY data_pesagem DESC',
        [':usuario_id' => $usuarioId]
    );
    jsonResponse($rows);
}

if ($method === 'PUT' && $path === '/api/usuarios/altura') {
    $usuarioId = requireAuth();
    $input = jsonInput();
    $altura = (float) ($input['altura'] ?? 0);

    if ($altura <= 0 || $altura > 3) {
        jsonResponse(['error' => 'Altura inválida'], 400);
    }

    dbExecute('UPDATE usuarios SET altura = :altura WHERE id = :id', [':altura' => $altura, ':id' => $usuarioId]);

    jsonResponse([
        'success' => true,
        'message' => 'Altura atualizada com sucesso!',
        'altura' => $altura,
    ]);
}

if ($method === 'GET' && $path === '/api/estatisticas') {
    try {
        $totalUsuarios = (int) (dbFetchOne('SELECT COUNT(*) AS c FROM usuarios')['c'] ?? 0);
        $totalPesagens = (int) (dbFetchOne('SELECT COUNT(*) AS c FROM pesagens WHERE excluido IS NULL OR excluido = 0')['c'] ?? 0);
        $pesoMedio = (float) (dbFetchOne('SELECT AVG(peso) AS media FROM pesagens WHERE excluido IS NULL OR excluido = 0')['media'] ?? 0);

        $usuariosComPesagem = dbFetchAll(
            'SELECT DISTINCT usuario_id FROM pesagens WHERE excluido IS NULL OR excluido = 0'
        );

        $perdaTotal = 0.0;
        foreach ($usuariosComPesagem as $row) {
            $uid = (int) ($row['usuario_id'] ?? 0);
            if ($uid <= 0) {
                continue;
            }

            $pesoInicial = dbFetchOne(
                'SELECT peso FROM pesagens WHERE usuario_id = :uid AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem ASC LIMIT 1',
                [':uid' => $uid]
            );
            $pesoAtual = dbFetchOne(
                'SELECT peso FROM pesagens WHERE usuario_id = :uid AND (excluido IS NULL OR excluido = 0) ORDER BY data_pesagem DESC LIMIT 1',
                [':uid' => $uid]
            );

            if ($pesoInicial && $pesoAtual) {
                $perdaTotal += ((float) $pesoInicial['peso'] - (float) $pesoAtual['peso']);
            }
        }

        jsonResponse([
            'total_usuarios' => $totalUsuarios,
            'total_pesagens' => $totalPesagens,
            'peso_medio_geral' => round($pesoMedio, 2),
            'perda_total_kg' => round($perdaTotal, 2),
        ]);
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Erro ao carregar estatísticas'], 500);
    }
}

if ($method === 'PUT' && preg_match('#^/api/pesagens/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $pesagemId = (int) $matches[1];
    $input = jsonInput();
    $peso = (float) ($input['peso'] ?? 0);

    if ($peso <= 0) {
        jsonResponse(['error' => 'Peso inválido'], 400);
    }

    $pesagem = dbFetchOne(
        'SELECT id FROM pesagens WHERE id = :id AND usuario_id = :usuario_id LIMIT 1',
        [':id' => $pesagemId, ':usuario_id' => $usuarioId]
    );

    if (!$pesagem) {
        jsonResponse(['error' => 'Pesagem não encontrada ou não pertence a você'], 404);
    }

    dbExecute('UPDATE pesagens SET peso = :peso WHERE id = :id', [':peso' => $peso, ':id' => $pesagemId]);
    jsonResponse(['success' => true, 'message' => 'Pesagem atualizada com sucesso']);
}

if ($method === 'DELETE' && preg_match('#^/api/pesagens/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $pesagemId = (int) $matches[1];

    $pesagem = dbFetchOne(
        'SELECT id FROM pesagens WHERE id = :id AND usuario_id = :usuario_id LIMIT 1',
        [':id' => $pesagemId, ':usuario_id' => $usuarioId]
    );

    if (!$pesagem) {
        jsonResponse(['error' => 'Pesagem não encontrada ou não pertence a você'], 404);
    }

    dbExecute('UPDATE pesagens SET excluido = 1 WHERE id = :id', [':id' => $pesagemId]);
    jsonResponse(['success' => true, 'message' => 'Pesagem excluída com sucesso']);
}

if ($method === 'POST' && preg_match('#^/api/pesagens/(\d+)/restaurar$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $pesagemId = (int) $matches[1];

    $pesagem = dbFetchOne(
        'SELECT id FROM pesagens WHERE id = :id AND usuario_id = :usuario_id LIMIT 1',
        [':id' => $pesagemId, ':usuario_id' => $usuarioId]
    );

    if (!$pesagem) {
        jsonResponse(['error' => 'Pesagem não encontrada ou não pertence a você'], 404);
    }

    dbExecute('UPDATE pesagens SET excluido = 0 WHERE id = :id', [':id' => $pesagemId]);
    jsonResponse(['success' => true, 'message' => 'Pesagem restaurada com sucesso']);
}

if ($method === 'GET' && preg_match('#^/api/pesagens/excluidas/(\d+)$#', $path, $matches) === 1) {
    $usuarioId = requireAuth();
    $targetId = (int) $matches[1];

    if ($usuarioId !== $targetId) {
        jsonResponse(['error' => 'Acesso negado'], 403);
    }

    $pesagens = dbFetchAll(
        'SELECT * FROM pesagens WHERE usuario_id = :usuario_id AND excluido = 1 ORDER BY data_pesagem DESC',
        [':usuario_id' => $targetId]
    );

    jsonResponse(['pesagens' => $pesagens]);
}

$pages = [
    '/login' => 'login.html',
    '/cadastro' => 'cadastro.html',
    '/recuperar-senha' => 'recuperar-senha.html',
    '/home' => 'home.html',
    '/pesagem' => 'pesagem.html',
    '/ranking' => 'ranking.html',
    '/bioimpedancia' => 'bioimpedancia.html',
    '/grupos-treino' => 'grupos-treino.html',
    '/treinador' => 'treinador.html',
];

if ($path === '/' || $path === '') {
    if (empty($_SESSION['userId'])) {
        redirectTo('/login');
    }
    redirectTo('/home');
}

if (array_key_exists($path, $pages)) {
    $protectedPages = ['/home', '/pesagem', '/ranking', '/bioimpedancia', '/grupos-treino', '/treinador'];
    if (in_array($path, $protectedPages, true) && empty($_SESSION['userId'])) {
        redirectTo('/login');
    }
    sendHtml($pages[$path]);
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Rota não encontrada';
