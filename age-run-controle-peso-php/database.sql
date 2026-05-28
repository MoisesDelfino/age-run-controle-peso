CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    sexo VARCHAR(20) DEFAULT 'masculino',
    altura DECIMAL(4,2) NULL,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    codigo_recuperacao VARCHAR(20) NULL,
    codigo_expiracao DATETIME NULL
);

CREATE TABLE IF NOT EXISTS pesagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    peso DECIMAL(6,2) NOT NULL,
    gordura_percentual DECIMAL(5,2) NULL,
    massa_muscular_percentual DECIMAL(5,2) NULL,
    agua_percentual DECIMAL(5,2) NULL,
    massa_ossea DECIMAL(5,2) NULL,
    metabolismo_basal INT NULL,
    idade_metabolica INT NULL,
    gordura_visceral INT NULL,
    data_pesagem DATETIME DEFAULT CURRENT_TIMESTAMP,
    excluido TINYINT(1) DEFAULT 0,
    CONSTRAINT fk_pesagens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rp_testes_historico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    treinador_id INT NOT NULL,
    prova VARCHAR(20) NULL,
    tempo_segundos INT NOT NULL,
    distancia_km DECIMAL(10,4) NOT NULL,
    pace_segundos_km DECIMAL(10,4) NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rp_testes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_testes_treinador FOREIGN KEY (treinador_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_pesagens_usuario_id ON pesagens(usuario_id);
CREATE INDEX idx_pesagens_data ON pesagens(data_pesagem);
CREATE INDEX idx_pesagens_excluido ON pesagens(excluido);
CREATE INDEX idx_rp_testes_usuario_data ON rp_testes_historico(usuario_id, criado_em);
