-- Script SQL para exportar dados (executar no IntelliJ/DataGrip)
-- Copia o resultado e salva como backup manual

-- ============================================
-- BACKUP MANUAL DE DADOS
-- Data: 16/05/2026
-- ============================================

-- 1. USUÁRIOS
SELECT 
  id,
  nome,
  email,
  senha,
  data_cadastro,
  codigo_recuperacao,
  codigo_expiracao
FROM usuarios
ORDER BY id;

-- 2. PESAGENS (ATIVAS)
SELECT 
  id,
  usuario_id,
  peso,
  data_pesagem,
  excluido
FROM pesagens
WHERE excluido = 0
ORDER BY data_pesagem DESC;

-- 3. ESTATÍSTICAS
SELECT 
  'Usuários' as tipo,
  COUNT(*) as total
FROM usuarios
UNION ALL
SELECT 
  'Pesagens ativas',
  COUNT(*)
FROM pesagens
WHERE excluido = 0
UNION ALL
SELECT 
  'Pesagens totais',
  COUNT(*)
FROM pesagens;

-- 4. RANKING ATUAL
SELECT 
  u.id,
  u.nome,
  u.email,
  COUNT(p.id) as total_pesagens,
  MIN(p.peso) as peso_minimo,
  MAX(p.peso) as peso_maximo,
  MAX(p.data_pesagem) as ultima_pesagem
FROM usuarios u
LEFT JOIN pesagens p ON u.id = p.usuario_id AND p.excluido = 0
GROUP BY u.id, u.nome, u.email
ORDER BY total_pesagens DESC, ultima_pesagem DESC;
