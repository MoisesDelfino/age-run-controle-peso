const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./database');
const { enviarCodigoRecuperacao } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Detectar ambiente
const isProduction = process.env.NODE_ENV === 'production';
const productionUrl = process.env.RENDER_EXTERNAL_URL || 'https://age-run-controle-peso.onrender.com';

// Configurar session store para PostgreSQL (produção)
let sessionStore;
if (process.env.DATABASE_URL) {
  const pgSession = require('connect-pg-simple')(session);
  const { Pool } = require('pg');
  
  const sessionPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  sessionStore = new pgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true
  });
  
  console.log('🔐 Sessões armazenadas no PostgreSQL');
} else {
  console.log('🔐 Sessões armazenadas em memória (desenvolvimento)');
}

// Confiar no proxy do Render
if (isProduction) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: isProduction 
    ? [productionUrl, 'https://age-run-controle-peso.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'age-run-secret-2026',
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  }
};

// Adicionar store PostgreSQL se disponível
if (sessionStore) {
  sessionConfig.store = sessionStore;
}

app.use(session(sessionConfig));
app.use(express.static('public'));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  next();
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Cadastro
app.post('/api/auth/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;
  
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  try {
    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    db.run(
      'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
      [nome.trim(), email.toLowerCase().trim(), senhaHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
          }
          return res.status(500).json({ error: err.message });
        }
        
        // Login automático após cadastro
        req.session.userId = this.lastID;
        req.session.nome = nome.trim();
        
        res.json({ 
          success: true,
          message: 'Cadastro realizado com sucesso!',
          usuario: { id: this.lastID, nome: nome.trim(), email }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  
  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  db.get(
    'SELECT * FROM usuarios WHERE email = ?',
    [email.toLowerCase().trim()],
    async (err, usuario) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!usuario) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos' });
      }

      try {
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        
        if (!senhaValida) {
          return res.status(401).json({ error: 'E-mail ou senha incorretos' });
        }

        // Criar sessão
        req.session.userId = usuario.id;
        req.session.nome = usuario.nome;
        
        res.json({ 
          success: true,
          message: 'Login realizado com sucesso!',
          usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
        });
      } catch (error) {
        res.status(500).json({ error: 'Erro ao fazer login' });
      }
    }
  );
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  console.log('🚪 Requisição de logout recebida');
  console.log('Session ID:', req.sessionID);
  console.log('User ID:', req.session?.userId);
  
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Erro ao destruir sessão:', err);
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    console.log('✅ Sessão destruída com sucesso');
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logout realizado' });
  });
});

// Verificar sessão
app.get('/api/auth/session', (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }
  
  db.get(
    'SELECT id, nome, email FROM usuarios WHERE id = ?',
    [req.session.userId],
    (err, usuario) => {
      if (err || !usuario) {
        return res.json({ authenticated: false });
      }
      res.json({ authenticated: true, usuario });
    }
  );
});

// Solicitar recuperação de senha
app.post('/api/auth/solicitar-recuperacao', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }

  db.get(
    'SELECT id, nome, email FROM usuarios WHERE email = ?',
    [email.toLowerCase().trim()],
    async (err, usuario) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!usuario) {
        return res.status(404).json({ error: 'E-mail não cadastrado' });
      }

      // Gerar código de 6 dígitos
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Definir expiração para 30 minutos
      const expiracao = new Date();
      expiracao.setMinutes(expiracao.getMinutes() + 30);
      
      db.run(
        'UPDATE usuarios SET codigo_recuperacao = ?, codigo_expiracao = ? WHERE id = ?',
        [codigo, expiracao.toISOString(), usuario.id],
        async (err) => {
          if (err) {
            return res.status(500).json({ error: 'Erro ao gerar código' });
          }
          
          // Enviar código por e-mail
          const emailEnviado = await enviarCodigoRecuperacao(usuario.email, usuario.nome, codigo);
          
          if (emailEnviado) {
            res.json({ 
              success: true,
              message: 'Código enviado para seu e-mail com sucesso!'
            });
          } else {
            res.json({ 
              success: true,
              message: 'Código gerado. Verifique o console do servidor.',
              warning: 'Serviço de e-mail não configurado'
            });
          }
        }
      );
    }
  );
});

// Redefinir senha
app.post('/api/auth/redefinir-senha', async (req, res) => {
  const { email, codigo, novaSenha } = req.body;
  
  if (!email || !codigo || !novaSenha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  if (novaSenha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  db.get(
    'SELECT id, codigo_recuperacao, codigo_expiracao FROM usuarios WHERE email = ?',
    [email.toLowerCase().trim()],
    async (err, usuario) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!usuario) {
        return res.status(404).json({ error: 'E-mail não encontrado' });
      }
      
      if (!usuario.codigo_recuperacao) {
        return res.status(400).json({ error: 'Nenhum código de recuperação foi solicitado' });
      }
      
      if (usuario.codigo_recuperacao !== codigo) {
        return res.status(400).json({ error: 'Código inválido' });
      }
      
      // Verificar expiração
      const agora = new Date();
      const expiracao = new Date(usuario.codigo_expiracao);
      
      if (agora > expiracao) {
        return res.status(400).json({ error: 'Código expirado. Solicite um novo código' });
      }
      
      try {
        // Hash da nova senha
        const senhaHash = await bcrypt.hash(novaSenha, 10);
        
        // Atualizar senha e limpar código
        db.run(
          'UPDATE usuarios SET senha = ?, codigo_recuperacao = NULL, codigo_expiracao = NULL WHERE id = ?',
          [senhaHash, usuario.id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Erro ao atualizar senha' });
            }
            
            res.json({ 
              success: true,
              message: 'Senha redefinida com sucesso'
            });
          }
        );
      } catch (error) {
        res.status(500).json({ error: 'Erro ao processar senha' });
      }
    }
  );
});

// ==================== ROTAS DE PESAGENS ====================

// Registrar pesagem (requer autenticação)
app.post('/api/pesagens', requireAuth, (req, res) => {
  const { peso, data_pesagem } = req.body;
  const usuario_id = req.session.userId;
  
  if (!peso) {
    return res.status(400).json({ error: 'Peso é obrigatório' });
  }

  const pesoNum = parseFloat(peso);
  if (isNaN(pesoNum) || pesoNum <= 0) {
    return res.status(400).json({ error: 'Peso inválido' });
  }

  // Se data_pesagem foi fornecida, usa ela; senão usa data/hora atual
  let query, params;
  if (data_pesagem) {
    query = 'INSERT INTO pesagens (usuario_id, peso, data_pesagem) VALUES (?, ?, ?)';
    params = [usuario_id, pesoNum, data_pesagem];
  } else {
    query = 'INSERT INTO pesagens (usuario_id, peso) VALUES (?, ?)';
    params = [usuario_id, pesoNum];
  }

  db.run(query, params, function(err) {
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
  console.log('🏆 Requisição de ranking recebida');
  console.log('Session ID:', req.sessionID);
  console.log('Authenticated:', req.session?.userId ? 'Sim' : 'Não');
  
  const query = `
    SELECT 
      u.id as usuario_id,
      u.nome,
      (SELECT peso FROM pesagens WHERE usuario_id = u.id AND excluido = 0 ORDER BY data_pesagem ASC LIMIT 1) as peso_inicial,
      (SELECT peso FROM pesagens WHERE usuario_id = u.id AND excluido = 0 ORDER BY data_pesagem DESC LIMIT 1) as peso_atual,
      COUNT(p.id) as total_pesagens
    FROM usuarios u
    LEFT JOIN pesagens p ON u.id = p.usuario_id AND p.excluido = 0
    GROUP BY u.id
    HAVING COUNT(p.id) > 0
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('❌ Erro ao buscar ranking:', err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log(`✅ Ranking carregado: ${rows.length} usuários`);
    
    const ranking = rows.map(row => ({
      ...row,
      diferenca: parseFloat((row.peso_atual - row.peso_inicial).toFixed(2))
    })).sort((a, b) => a.diferenca - b.diferenca)
    .map((row, index) => ({
      ...row,
      posicao: index + 1
    }));
    
    res.json({ ranking });
  });
});

// Obter pesagens de um usuário específico
app.get('/api/pesagens/usuario/:id', requireAuth, (req, res) => {
  const usuarioId = parseInt(req.params.id);
  
  // Verificar se o usuário está acessando seus próprios dados
  if (usuarioId !== req.session.userId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  db.all(
    'SELECT * FROM pesagens WHERE usuario_id = ? AND excluido = 0 ORDER BY data_pesagem DESC',
    [usuarioId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ pesagens: rows });
    }
  );
});

// Obter histórico do usuário logado
app.get('/api/meu-historico', requireAuth, (req, res) => {
  db.all(
    'SELECT * FROM pesagens WHERE usuario_id = ? ORDER BY data_pesagem DESC',
    [req.session.userId],
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

// Editar pesagem
app.put('/api/pesagens/:id', requireAuth, (req, res) => {
  const pesagemId = parseInt(req.params.id);
  const { peso } = req.body;
  
  if (!peso || isNaN(peso) || peso <= 0) {
    return res.status(400).json({ error: 'Peso inválido' });
  }
  
  // Verificar se a pesagem pertence ao usuário
  db.get(
    'SELECT * FROM pesagens WHERE id = ? AND usuario_id = ?',
    [pesagemId, req.session.userId],
    (err, pesagem) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!pesagem) {
        return res.status(404).json({ error: 'Pesagem não encontrada ou não pertence a você' });
      }
      
      // Atualizar o peso
      db.run(
        'UPDATE pesagens SET peso = ? WHERE id = ?',
        [peso, pesagemId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, message: 'Pesagem atualizada com sucesso' });
        }
      );
    }
  );
});

// Excluir pesagem (soft delete)
app.delete('/api/pesagens/:id', requireAuth, (req, res) => {
  const pesagemId = parseInt(req.params.id);
  
  // Verificar se a pesagem pertence ao usuário
  db.get(
    'SELECT * FROM pesagens WHERE id = ? AND usuario_id = ?',
    [pesagemId, req.session.userId],
    (err, pesagem) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!pesagem) {
        return res.status(404).json({ error: 'Pesagem não encontrada ou não pertence a você' });
      }
      
      // Marcar como excluído
      db.run(
        'UPDATE pesagens SET excluido = 1 WHERE id = ?',
        [pesagemId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, message: 'Pesagem excluída com sucesso' });
        }
      );
    }
  );
});

// Restaurar pesagem
app.post('/api/pesagens/:id/restaurar', requireAuth, (req, res) => {
  const pesagemId = parseInt(req.params.id);
  
  // Verificar se a pesagem pertence ao usuário
  db.get(
    'SELECT * FROM pesagens WHERE id = ? AND usuario_id = ?',
    [pesagemId, req.session.userId],
    (err, pesagem) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!pesagem) {
        return res.status(404).json({ error: 'Pesagem não encontrada ou não pertence a você' });
      }
      
      // Restaurar (marcar como não excluído)
      db.run(
        'UPDATE pesagens SET excluido = 0 WHERE id = ?',
        [pesagemId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, message: 'Pesagem restaurada com sucesso' });
        }
      );
    }
  );
});

// Obter pesagens excluídas do usuário
app.get('/api/pesagens/excluidas/:id', requireAuth, (req, res) => {
  const usuarioId = parseInt(req.params.id);
  
  // Verificar se o usuário está acessando seus próprios dados
  if (usuarioId !== req.session.userId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  db.all(
    'SELECT * FROM pesagens WHERE usuario_id = ? AND excluido = 1 ORDER BY data_pesagem DESC',
    [usuarioId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ pesagens: rows });
    }
  );
});

// ==================== ROTAS DE PÁGINAS ====================

// Página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Página de cadastro
app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

// Página de recuperação de senha
app.get('/recuperar-senha', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recuperar-senha.html'));
});

// Página home (requer autenticação)
app.get('/home', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Página de pesagem (requer autenticação)
app.get('/pesagem', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'pesagem.html'));
});

// Página de ranking (requer autenticação)
app.get('/ranking', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'ranking.html'));
});

// Página principal (redireciona para home)
app.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.redirect('/home');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🏃‍♂️ Sistema de Controle de Peso Age Run`);
});

module.exports = app;
