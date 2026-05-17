-- Script de inicialização do banco de dados PostgreSQL
-- Execute este script no console SQL do PostgreSQL

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  codigo_recuperacao TEXT,
  codigo_expiracao TIMESTAMP
);

-- Tabela de pesagens
CREATE TABLE IF NOT EXISTS pesagens (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  peso REAL NOT NULL,
  data_pesagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  excluido INTEGER DEFAULT 0,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pesagens_usuario_id ON pesagens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pesagens_data ON pesagens(data_pesagem);
CREATE INDEX IF NOT EXISTS idx_pesagens_excluido ON pesagens(excluido);

-- Verificar tabelas criadas
SELECT 
  tablename, 
  schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
