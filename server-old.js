const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// ==================== ROTAS API ====================

// Listar todos os usuários
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT * FROM usuarios ORDER BY nome', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Buscar ou criar usuário
app.post('/api/usuarios', (req, res) => {
  const { nome } = req.body;
  
  if (!nome || nome.trim() === '') {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  // Verificar se usuário já existe
  db.get('SELECT * FROM usuarios WHERE LOWER(nome) = LOWER(?)', [nome.trim()], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (row) {
      // Usuário já existe
      return res.json(row);
    }
    
    // Criar novo usuário
    db.run('INSERT INTO usuarios (nome) VALUES (?)', [nome.trim()], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, nome: nome.trim() });
    });
  });
});

// Registrar pesagem
app.post('/api/pesagens', (req, res) => {
  const { usuario_id, peso } = req.body;
  
  if (!usuario_id || !peso) {
    return res.status(400).json({ error: 'Usuário e peso são obrigatórios' });
  }

  const pesoNum = parseFloat(peso);
  if (isNaN(pesoNum) || pesoNum <= 0) {
    return res.status(400).json({ error: 'Peso inválido' });
  }

  db.run(
    'INSERT INTO pesagens (usuario_id, peso) VALUES (?, ?)',
    [usuario_id, pesoNum],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        id: this.lastID, 
        usuario_id, 
        peso: pesoNum,
        message: 'Pesagem registrada com sucesso!' 
      });
    }
  );
});

// Obter ranking de perda de peso
app.get('/api/ranking', (req, res) => {
  const query = `
    SELECT 
      u.id,
      u.nome,
      MIN(p.peso) as peso_inicial,
      MAX(p.peso) as peso_maximo,
      (SELECT peso FROM pesagens WHERE usuario_id = u.id ORDER BY data_pesagem DESC LIMIT 1) as peso_atual,
      (SELECT data_pesagem FROM pesagens WHERE usuario_id = u.id ORDER BY data_pesagem ASC LIMIT 1) as primeira_pesagem,
      (SELECT data_pesagem FROM pesagens WHERE usuario_id = u.id ORDER BY data_pesagem DESC LIMIT 1) as ultima_pesagem,
      COUNT(p.id) as total_pesagens
    FROM usuarios u
    LEFT JOIN pesagens p ON u.id = p.usuario_id
    GROUP BY u.id
    HAVING COUNT(p.id) > 0
    ORDER BY (peso_maximo - peso_atual) DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Calcular diferença e adicionar ranking
    const ranking = rows.map((row, index) => ({
      ...row,
      diferenca: (row.peso_maximo - row.peso_atual).toFixed(2),
      posicao: index + 1
    }));
    
    res.json(ranking);
  });
});

// Obter histórico de um usuário
app.get('/api/usuarios/:id/historico', (req, res) => {
  const { id } = req.params;
  
  db.all(
    'SELECT * FROM pesagens WHERE usuario_id = ? ORDER BY data_pesagem DESC',
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Obter estatísticas gerais
app.get('/api/estatisticas', (req, res) => {
  const query = `
    SELECT 
      COUNT(DISTINCT u.id) as total_usuarios,
      COUNT(p.id) as total_pesagens,
      ROUND(AVG(p.peso), 2) as peso_medio_geral,
      ROUND(SUM(
        (SELECT MAX(peso) FROM pesagens WHERE usuario_id = u.id) - 
        (SELECT peso FROM pesagens WHERE usuario_id = u.id ORDER BY data_pesagem DESC LIMIT 1)
      ), 2) as perda_total_kg
    FROM usuarios u
    LEFT JOIN pesagens p ON u.id = p.usuario_id
  `;
  
  db.get(query, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Sistema de Controle de Peso Online`);
});

module.exports = app;
