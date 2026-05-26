<?php

declare(strict_types=1);

require_once __DIR__ . '/src/config.php';

$config = appConfig();
$db = $config['db'] ?? [];
$driver = strtolower((string) ($db['driver'] ?? ''));

$schemaFile = __DIR__ . '/database.pgsql.sql';
$dataCandidates = [
  __DIR__ . '/storage/snapshots/render_prod_usuarios_pesagens.sql',
  __DIR__ . '/storage/snapshots/peso.current.2026-05-25.pgsql.sql',
];
$dataFile = '';
foreach ($dataCandidates as $candidate) {
  if (is_file($candidate)) {
    $dataFile = $candidate;
    break;
  }
}

$isRenderDump = $dataFile !== '' && str_contains(basename($dataFile), 'render_prod_usuarios_pesagens.sql');

function runSqlWithPsql(array $db, string $filePath): void
{
  $psqlCandidates = ['/usr/bin/psql', '/usr/local/bin/psql', 'psql'];
  $psql = null;

  foreach ($psqlCandidates as $candidate) {
    if ($candidate === 'psql') {
      $which = trim((string) shell_exec('command -v psql 2>/dev/null'));
      if ($which !== '') {
        $psql = $which;
        break;
      }
      continue;
    }

    if (is_executable($candidate)) {
      $psql = $candidate;
      break;
    }
  }

  if ($psql === null) {
    throw new RuntimeException('psql nao encontrado no servidor.');
  }

  $host = (string) ($db['host'] ?? 'localhost');
  $port = (string) ($db['port'] ?? '5432');
  $user = (string) ($db['username'] ?? '');
  $database = (string) ($db['database'] ?? '');

  if ($user === '' || $database === '') {
    throw new RuntimeException('Credenciais de banco incompletas no .env.');
  }

  $cmd = sprintf(
    '%s -v ON_ERROR_STOP=1 -h %s -p %s -U %s -d %s -f %s',
    escapeshellarg($psql),
    escapeshellarg($host),
    escapeshellarg($port),
    escapeshellarg($user),
    escapeshellarg($database),
    escapeshellarg($filePath)
  );

  $env = $_ENV;
  $env['PGPASSWORD'] = (string) ($db['password'] ?? '');

  $descriptor = [
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
  ];

  $process = proc_open($cmd, $descriptor, $pipes, null, $env);
  if (!is_resource($process)) {
    throw new RuntimeException('Nao foi possivel iniciar o psql.');
  }

  $stdout = stream_get_contents($pipes[1]) ?: '';
  $stderr = stream_get_contents($pipes[2]) ?: '';
  fclose($pipes[1]);
  fclose($pipes[2]);

  $exitCode = proc_close($process);
  if ($exitCode !== 0) {
    $msg = trim($stderr !== '' ? $stderr : $stdout);
    throw new RuntimeException('psql falhou: ' . $msg);
  }
}

function sanitizePgDumpSql(string $sql): string
{
  // Remove comandos meta do psql adicionados por versões recentes do pg_dump.
  $sql = preg_replace('/^\\\\restrict\s+.*$/m', '', $sql) ?? $sql;
  $sql = preg_replace('/^\\\\unrestrict\s+.*$/m', '', $sql) ?? $sql;

  // Remove parâmetros de configuração que podem não existir em versões antigas do PostgreSQL.
  $sql = preg_replace('/^\s*SET\s+transaction_timeout\s*=\s*[^;]+;\s*$/mi', '', $sql) ?? $sql;
  $sql = preg_replace("/^\\s*SELECT\\s+pg_catalog\\.set_config\\(\\s*'transaction_timeout'\\s*,\\s*'[^']*'\\s*,\\s*(true|false)\\s*\\);\\s*$/mi", '', $sql) ?? $sql;

  // Evita conflito quando destino usa coluna IDENTITY (não aceita ALTER ... DROP/SET DEFAULT no id).
  $sql = preg_replace('/^\s*ALTER\s+TABLE\s+ONLY\s+public\.usuarios\s+ALTER\s+COLUMN\s+id\s+(DROP|SET)\s+DEFAULT\s*;\s*$/mi', '', $sql) ?? $sql;
  $sql = preg_replace('/^\s*ALTER\s+TABLE\s+ONLY\s+public\.pesagens\s+ALTER\s+COLUMN\s+id\s+(DROP|SET)\s+DEFAULT\s*;\s*$/mi', '', $sql) ?? $sql;
  $sql = preg_replace('/^\s*ALTER\s+TABLE\s+IF\s+EXISTS\s+public\.usuarios\s+ALTER\s+COLUMN\s+id\s+DROP\s+DEFAULT\s*;\s*$/mi', '', $sql) ?? $sql;
  $sql = preg_replace('/^\s*ALTER\s+TABLE\s+IF\s+EXISTS\s+public\.pesagens\s+ALTER\s+COLUMN\s+id\s+DROP\s+DEFAULT\s*;\s*$/mi', '', $sql) ?? $sql;

  return $sql;
}

function importRenderDataOnly(PDO $pdo, string $dataSql): void
{
  // Estratégia definitiva para dumps do Render em ambientes com IDENTITY:
  // limpa dados atuais e reaplica apenas INSERTs, sem DDL de sequência/tabela.
  $pdo->beginTransaction();
  try {
    $pdo->exec('TRUNCATE TABLE public.pesagens, public.usuarios RESTART IDENTITY CASCADE');

    if (preg_match_all('/^\s*INSERT\s+INTO\s+public\.(usuarios|pesagens)\b.*;\s*$/mi', $dataSql, $matches) !== false) {
      foreach ($matches[0] as $insertSql) {
        $stmt = trim($insertSql);
        if ($stmt !== '') {
          $pdo->exec($stmt);
        }
      }
    }

    // Reposiciona sequência para evitar conflito no próximo INSERT sem id explícito.
    $pdo->exec("SELECT setval(pg_get_serial_sequence('public.usuarios','id'), COALESCE((SELECT MAX(id) FROM public.usuarios), 1), true)");
    $pdo->exec("SELECT setval(pg_get_serial_sequence('public.pesagens','id'), COALESCE((SELECT MAX(id) FROM public.pesagens), 1), true)");

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
}

$expectedToken = (string) env('IMPORT_TOKEN', '');
$providedToken = (string) ($_GET['token'] ?? '');

if ($expectedToken !== '' && !hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    echo 'Token invalido para importacao.';
    exit;
}

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($driver !== 'pgsql') {
        $error = 'DB_DRIVER nao esta como pgsql no .env.';
  } elseif (!is_file($schemaFile) || $dataFile === '' || !is_file($dataFile)) {
        $error = 'Arquivos SQL nao encontrados no servidor.';
    } else {
        try {
      $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        (string) ($db['host'] ?? 'localhost'),
        (string) ($db['port'] ?? '5432'),
        (string) ($db['database'] ?? '')
      );

      $pdo = new PDO(
        $dsn,
        (string) ($db['username'] ?? ''),
        (string) ($db['password'] ?? ''),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
      );

      // Dump do Render: aplica somente dados (sem DDL), evitando conflitos de sequência/identity.
      if ($isRenderDump) {
        $dataSql = file_get_contents($dataFile);
        if ($dataSql === false) {
          throw new RuntimeException('Falha ao ler arquivo de dados do Render.');
        }

        $dataSql = sanitizePgDumpSql($dataSql);
        if (preg_match('/COPY\s+.+\s+FROM\s+stdin;/i', $dataSql) === 1) {
          throw new RuntimeException('Dump em formato COPY detectado. Gere novo dump com --inserts --column-inserts para importar no modo definitivo.');
        }

        importRenderDataOnly($pdo, $dataSql);
      } else {
        // Fluxo padrão: tenta psql e, se falhar, fallback em PDO.
        try {
          runSqlWithPsql($db, $schemaFile);
          runSqlWithPsql($db, $dataFile);
        } catch (Throwable $psqlError) {
          $schemaSql = file_get_contents($schemaFile);
          $dataSql = file_get_contents($dataFile);

          if ($schemaSql === false || $dataSql === false) {
            throw new RuntimeException('Falha ao ler arquivos SQL.');
          }

          $schemaSql = sanitizePgDumpSql($schemaSql);
          $dataSql = sanitizePgDumpSql($dataSql);

          if (preg_match('/COPY\s+.+\s+FROM\s+stdin;/i', $dataSql) === 1) {
            throw new RuntimeException('Dump em formato COPY detectado. Gere novo dump com --inserts --column-inserts para importar sem psql no servidor.');
          }

          if (trim($schemaSql) !== '') {
            $pdo->exec($schemaSql);
          }
          $pdo->exec($dataSql);
        }
      }

            $message = 'Importacao concluida com sucesso. Remova este arquivo por seguranca.';
        } catch (Throwable $e) {
            $error = 'Falha na importacao: ' . $e->getMessage();
        }
    }
}

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Importador PostgreSQL - Age Run</title>
  <style>
    body { font-family: Arial, sans-serif; background: #101114; color: #f3f3f3; margin: 0; padding: 24px; }
    .box { max-width: 760px; margin: 0 auto; background: #191b21; border: 1px solid #2a2e38; border-radius: 10px; padding: 20px; }
    h1 { margin-top: 0; font-size: 22px; }
    .ok { background: #143322; border: 1px solid #1f6a44; color: #b7f3d0; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
    .err { background: #3a1a1a; border: 1px solid #7f2f2f; color: #ffc0c0; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
    .meta { font-size: 14px; color: #c7ccd8; line-height: 1.6; }
    button { background: #1f8fff; color: #fff; border: 0; border-radius: 8px; padding: 12px 18px; cursor: pointer; font-weight: 600; }
    button:hover { background: #3aa0ff; }
    code { color: #c8e5ff; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Importador PostgreSQL (Age Run)</h1>

    <?php if ($message !== ''): ?>
      <div class="ok"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></div>
    <?php endif; ?>

    <?php if ($error !== ''): ?>
      <div class="err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
    <?php endif; ?>

    <div class="meta">
      <p><strong>Driver atual:</strong> <?= htmlspecialchars($driver, ENT_QUOTES, 'UTF-8') ?></p>
      <p><strong>Host:</strong> <?= htmlspecialchars((string) ($db['host'] ?? ''), ENT_QUOTES, 'UTF-8') ?>:<?= htmlspecialchars((string) ($db['port'] ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
      <p><strong>Banco:</strong> <?= htmlspecialchars((string) ($db['database'] ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
      <p><strong>Arquivos:</strong><br>
      - <code><?= $isRenderDump ? 'schema local ignorado (dump do Render ja contem estrutura)' : 'database.pgsql.sql' ?></code><br>
      - <code><?= htmlspecialchars(str_replace(__DIR__ . '/', '', $dataFile), ENT_QUOTES, 'UTF-8') ?></code></p>
      <p>Este processo cria as tabelas e importa os dados atuais.</p>
    </div>

    <form method="post">
      <button type="submit">Executar importacao PostgreSQL</button>
    </form>

    <p class="meta" style="margin-top: 16px;">Depois da importacao, apague este arquivo: <code>import_pgsql.php</code>.</p>
  </div>
</body>
</html>
