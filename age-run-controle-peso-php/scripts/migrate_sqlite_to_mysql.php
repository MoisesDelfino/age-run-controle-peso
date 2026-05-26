<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Execute este script via CLI.\n");
    exit(1);
}

if ($argc < 6) {
    fwrite(STDERR, "Uso:\n");
    fwrite(STDERR, "php scripts/migrate_sqlite_to_mysql.php <sqlite_path> <mysql_host> <mysql_db> <mysql_user> <mysql_pass> [mysql_port]\n");
    exit(1);
}

[$script, $sqlitePath, $mysqlHost, $mysqlDb, $mysqlUser, $mysqlPass] = $argv;
$mysqlPort = $argv[6] ?? '3306';

if (!is_file($sqlitePath)) {
    fwrite(STDERR, "Arquivo SQLite não encontrado: {$sqlitePath}\n");
    exit(1);
}

try {
    $sqlite = new PDO('sqlite:' . $sqlitePath);
    $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $mysql = new PDO(
        "mysql:host={$mysqlHost};port={$mysqlPort};dbname={$mysqlDb};charset=utf8mb4",
        $mysqlUser,
        $mysqlPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    echo "Conexões ok. Iniciando migração...\n";

    $mysql->beginTransaction();
    $mysql->exec('SET FOREIGN_KEY_CHECKS=0');
    $mysql->exec('TRUNCATE TABLE pesagens');
    $mysql->exec('TRUNCATE TABLE usuarios');
    $mysql->exec('SET FOREIGN_KEY_CHECKS=1');

    $users = $sqlite->query('SELECT id, nome, email, senha, sexo, altura, data_cadastro, codigo_recuperacao, codigo_expiracao FROM usuarios')->fetchAll(PDO::FETCH_ASSOC);

    $insertUser = $mysql->prepare(
        'INSERT INTO usuarios (id, nome, email, senha, sexo, altura, data_cadastro, codigo_recuperacao, codigo_expiracao)
         VALUES (:id, :nome, :email, :senha, :sexo, :altura, :data_cadastro, :codigo_recuperacao, :codigo_expiracao)'
    );

    foreach ($users as $u) {
        $insertUser->execute([
            ':id' => (int) $u['id'],
            ':nome' => $u['nome'],
            ':email' => $u['email'],
            ':senha' => $u['senha'],
            ':sexo' => $u['sexo'] ?: 'masculino',
            ':altura' => $u['altura'] !== null ? (float) $u['altura'] : null,
            ':data_cadastro' => $u['data_cadastro'],
            ':codigo_recuperacao' => $u['codigo_recuperacao'],
            ':codigo_expiracao' => $u['codigo_expiracao'],
        ]);
    }

    $pesagens = $sqlite->query('SELECT id, usuario_id, peso, gordura_percentual, massa_muscular_percentual, agua_percentual, massa_ossea, metabolismo_basal, idade_metabolica, gordura_visceral, data_pesagem, excluido FROM pesagens')->fetchAll(PDO::FETCH_ASSOC);

    $insertPesagem = $mysql->prepare(
        'INSERT INTO pesagens (
            id, usuario_id, peso, gordura_percentual, massa_muscular_percentual, agua_percentual,
            massa_ossea, metabolismo_basal, idade_metabolica, gordura_visceral, data_pesagem, excluido
         ) VALUES (
            :id, :usuario_id, :peso, :gordura_percentual, :massa_muscular_percentual, :agua_percentual,
            :massa_ossea, :metabolismo_basal, :idade_metabolica, :gordura_visceral, :data_pesagem, :excluido
         )'
    );

    foreach ($pesagens as $p) {
        $insertPesagem->execute([
            ':id' => (int) $p['id'],
            ':usuario_id' => (int) $p['usuario_id'],
            ':peso' => (float) $p['peso'],
            ':gordura_percentual' => $p['gordura_percentual'] !== null ? (float) $p['gordura_percentual'] : null,
            ':massa_muscular_percentual' => $p['massa_muscular_percentual'] !== null ? (float) $p['massa_muscular_percentual'] : null,
            ':agua_percentual' => $p['agua_percentual'] !== null ? (float) $p['agua_percentual'] : null,
            ':massa_ossea' => $p['massa_ossea'] !== null ? (float) $p['massa_ossea'] : null,
            ':metabolismo_basal' => $p['metabolismo_basal'] !== null ? (int) $p['metabolismo_basal'] : null,
            ':idade_metabolica' => $p['idade_metabolica'] !== null ? (int) $p['idade_metabolica'] : null,
            ':gordura_visceral' => $p['gordura_visceral'] !== null ? (int) $p['gordura_visceral'] : null,
            ':data_pesagem' => $p['data_pesagem'],
            ':excluido' => isset($p['excluido']) ? (int) $p['excluido'] : 0,
        ]);
    }

    $nextUserId = (int) $mysql->query('SELECT COALESCE(MAX(id), 0) + 1 FROM usuarios')->fetchColumn();
    $nextPesagemId = (int) $mysql->query('SELECT COALESCE(MAX(id), 0) + 1 FROM pesagens')->fetchColumn();

    $mysql->exec("ALTER TABLE usuarios AUTO_INCREMENT = {$nextUserId}");
    $mysql->exec("ALTER TABLE pesagens AUTO_INCREMENT = {$nextPesagemId}");

    $mysql->commit();

    echo 'Migração finalizada com sucesso.' . PHP_EOL;
    echo 'Usuários migrados: ' . count($users) . PHP_EOL;
    echo 'Pesagens migradas: ' . count($pesagens) . PHP_EOL;
} catch (Throwable $e) {
    if (isset($mysql) && $mysql instanceof PDO && $mysql->inTransaction()) {
        $mysql->rollBack();
    }
    fwrite(STDERR, 'Falha na migração: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
