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
const APP_BASE_PATH = process.env.APP_BASE_PATH || '/controle';
const CONTROL_COMPAT_BASE = '/controle';

const basePath = (suffix = '') => `${APP_BASE_PATH}${suffix}`;

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
  app.set('trust proxy', true);
}

// Middleware
app.use(cors({
  origin: isProduction 
    ? [productionUrl, 'https://age-run-controle-peso.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
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
  name: 'age_run.sid',
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure: isProduction ? 'auto' : false,
    sameSite: 'lax'
  }
};

// Adicionar store PostgreSQL se disponível
if (sessionStore) {
  sessionConfig.store = sessionStore;
}

app.use(session(sessionConfig));
app.use(express.static('public'));
app.use(APP_BASE_PATH, express.static('public', { index: false }));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  next();
}

function normalizePerfil(perfil) {
  const raw = String(perfil || '').trim().toLowerCase();
  return raw || 'aluno';
}

function requireTrainer(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const sessionPerfil = normalizePerfil(req.session.perfil);
  if (sessionPerfil === 'treinador') {
    return next();
  }

  db.get(
    'SELECT perfil FROM usuarios WHERE id = ?',
    [req.session.userId],
    (err, usuario) => {
      if (err || !usuario) {
        return res.status(500).json({ error: 'Erro ao validar perfil de acesso' });
      }

      const perfil = normalizePerfil(usuario.perfil);
      req.session.perfil = perfil;

      if (perfil !== 'treinador') {
        return res.status(403).json({ error: 'Acesso permitido apenas para treinador' });
      }

      return next();
    }
  );
}

function requireTrainerPage(req, res, next) {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }

  const sessionPerfil = normalizePerfil(req.session.perfil);
  if (sessionPerfil === 'treinador') {
    return next();
  }

  db.get(
    'SELECT perfil FROM usuarios WHERE id = ?',
    [req.session.userId],
    (err, usuario) => {
      if (err || !usuario) {
        return res.redirect(basePath('/home'));
      }

      const perfil = normalizePerfil(usuario.perfil);
      req.session.perfil = perfil;

      if (perfil !== 'treinador') {
        return res.redirect(basePath('/home'));
      }

      return next();
    }
  );
}

const RACE_COLUMNS = ['rp_5k', 'rp_10k', 'rp_21k', 'rp_42k'];
const RP_STATUS_COLUMNS = {
  rp_5k: 'rp_5k_status',
  rp_10k: 'rp_10k_status',
  rp_21k: 'rp_21k_status',
  rp_42k: 'rp_42k_status'
};
const RP_APPROVAL_STATUSES = ['pendente', 'aprovado', 'reprovado'];
const RACE_DISTANCES = {
  rp_5k: 5,
  rp_10k: 10,
  rp_21k: 21.0975,
  rp_42k: 42.195
};

function parseRaceTimeToSeconds(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    const parsed = Math.round(value);
    return parsed > 0 ? parsed : null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => parseInt(part, 10));
    if (parts.some((part) => Number.isNaN(part) || part < 0)) {
      return NaN;
    }

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      if (seconds >= 60) {
        return NaN;
      }
      return (minutes * 60) + seconds;
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      if (minutes >= 60 || seconds >= 60) {
        return NaN;
      }
      return (hours * 3600) + (minutes * 60) + seconds;
    }

    return NaN;
  }

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return NaN;
  }

  return parsed;
}

function formatSecondsToRaceTime(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return null;
  }

  const total = Math.max(0, Math.round(Number(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatPace(secondsPerKm) {
  if (!secondsPerKm || Number.isNaN(secondsPerKm) || secondsPerKm <= 0) {
    return null;
  }

  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} /km`;
}

function calculatePerformanceScore(user) {
  let weightedPaceSum = 0;
  let weightTotal = 0;

  Object.entries(RACE_DISTANCES).forEach(([column, distanceKm]) => {
    const value = Number(user[column]);
    if (!value || Number.isNaN(value) || value <= 0) {
      return;
    }

    const pace = value / distanceKm;
    weightedPaceSum += pace * distanceKm;
    weightTotal += distanceKm;
  });

  if (!weightTotal) {
    return null;
  }

  return weightedPaceSum / weightTotal;
}

function mapRunnerForGroup(user, myScore) {
  const score = calculatePerformanceScore(user);
  const deltaPercent = myScore > 0 && score !== null
    ? Number((((score - myScore) / myScore) * 100).toFixed(2))
    : 0;

  return {
    usuario_id: user.id,
    nome: user.nome,
    rp_5k: user.rp_5k ?? null,
    rp_10k: user.rp_10k ?? null,
    rp_21k: user.rp_21k ?? null,
    rp_42k: user.rp_42k ?? null,
    rp_5k_formatado: formatSecondsToRaceTime(user.rp_5k),
    rp_10k_formatado: formatSecondsToRaceTime(user.rp_10k),
    rp_21k_formatado: formatSecondsToRaceTime(user.rp_21k),
    rp_42k_formatado: formatSecondsToRaceTime(user.rp_42k),
    ritmo_medio_seg_km: score,
    ritmo_medio_formatado: formatPace(score),
    diferenca_percentual: deltaPercent
  };
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Cadastro
app.post('/api/auth/cadastro', async (req, res) => {
  const { nome, email, senha, sexo } = req.body;
  const sexoNormalizado = (sexo || '').toLowerCase().trim();
  
  if (!nome || !email || !senha || !sexoNormalizado) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  if (!['masculino', 'feminino'].includes(sexoNormalizado)) {
    return res.status(400).json({ error: 'Sexo inválido' });
  }

  try {
    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    db.run(
      'INSERT INTO usuarios (nome, email, senha, sexo) VALUES (?, ?, ?, ?)',
      [nome.trim(), email.toLowerCase().trim(), senhaHash, sexoNormalizado],
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
        req.session.sexo = sexoNormalizado;
        req.session.perfil = 'aluno';

        req.session.save((sessionErr) => {
          if (sessionErr) {
            return res.status(500).json({ error: 'Erro ao salvar sessão' });
          }

          res.json({ 
            success: true,
            message: 'Cadastro realizado com sucesso!',
            usuario: { id: this.lastID, nome: nome.trim(), email, sexo: sexoNormalizado, perfil: 'aluno' }
          });
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
        req.session.sexo = usuario.sexo || 'masculino';
        req.session.perfil = normalizePerfil(usuario.perfil);

        req.session.save((sessionErr) => {
          if (sessionErr) {
            return res.status(500).json({ error: 'Erro ao salvar sessão' });
          }

          res.json({ 
            success: true,
            message: 'Login realizado com sucesso!',
            usuario: {
              id: usuario.id,
              nome: usuario.nome,
              email: usuario.email,
              sexo: usuario.sexo || 'masculino',
              perfil: normalizePerfil(usuario.perfil)
            }
          });
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
    'SELECT id, nome, email, altura, sexo, perfil FROM usuarios WHERE id = ?',
    [req.session.userId],
    (err, usuario) => {
      if (err) {
        const message = err.message || '';
        const semColunaAltura = message.includes('column') && message.includes('altura');
        const semColunaSexo = message.includes('column') && message.includes('sexo');
        const semColunaPerfil = message.includes('column') && message.includes('perfil');

        if (semColunaAltura || semColunaSexo || semColunaPerfil) {
          return db.get(
            'SELECT id, nome, email FROM usuarios WHERE id = ?',
            [req.session.userId],
            (fallbackErr, fallbackUsuario) => {
              if (fallbackErr || !fallbackUsuario) {
                return res.json({ authenticated: false });
              }
              return res.json({ ...fallbackUsuario, altura: null, sexo: 'masculino', perfil: 'aluno', authenticated: true });
            }
          );
        }

        return res.json({ authenticated: false });
      }

      if (!usuario) {
        return res.json({ authenticated: false });
      }

      req.session.perfil = normalizePerfil(usuario.perfil);

      // Retornar diretamente os dados do usuário + authenticated
      res.json({
        ...usuario,
        altura: usuario.altura ?? null,
        sexo: usuario.sexo || 'masculino',
        perfil: normalizePerfil(usuario.perfil),
        authenticated: true
      });
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
  const { 
    peso, 
    data_pesagem,
    gordura_percentual,
    massa_muscular_percentual,
    agua_percentual,
    massa_ossea,
    metabolismo_basal,
    idade_metabolica,
    gordura_visceral
  } = req.body;
  
  const usuario_id = req.session.userId;
  
  if (!peso) {
    return res.status(400).json({ error: 'Peso é obrigatório' });
  }

  const pesoNum = parseFloat(peso);
  if (isNaN(pesoNum) || pesoNum <= 0) {
    return res.status(400).json({ error: 'Peso inválido' });
  }

  // Construir query dinamicamente incluindo dados de bioimpedância
  const campos = ['usuario_id', 'peso'];
  const valores = [usuario_id, pesoNum];
  const placeholders = ['?', '?'];
  
  if (data_pesagem) {
    campos.push('data_pesagem');
    valores.push(data_pesagem);
    placeholders.push('?');
  }
  
  // Adicionar campos de bioimpedância se fornecidos
  const camposBio = {
    gordura_percentual,
    massa_muscular_percentual,
    agua_percentual,
    massa_ossea,
    metabolismo_basal,
    idade_metabolica,
    gordura_visceral
  };
  
  for (const [campo, valor] of Object.entries(camposBio)) {
    if (valor !== null && valor !== undefined && valor !== '') {
      campos.push(campo);
      valores.push(parseFloat(valor) || parseInt(valor));
      placeholders.push('?');
    }
  }
  
  const query = `INSERT INTO pesagens (${campos.join(', ')}) VALUES (${placeholders.join(', ')})`;

  db.run(query, valores, function(err) {
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
app.get('/api/ranking', requireAuth, (req, res) => {
  console.log('🏆 Requisição de ranking recebida');
  console.log('Session ID:', req.sessionID);
  console.log('Authenticated:', req.session?.userId ? 'Sim' : 'Não');

  db.get(
    'SELECT sexo FROM usuarios WHERE id = ?',
    [req.session.userId],
    (sexoErr, usuario) => {
      if (sexoErr || !usuario) {
        return res.status(500).json({ error: 'Erro ao validar perfil de acesso' });
      }

      if ((usuario.sexo || '').toLowerCase() === 'feminino') {
        return res.status(403).json({
          error: 'Ranking geral indisponível para este perfil',
          code: 'RANKING_RESTRITO'
        });
      }
  
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
        
        const ranking = rows.map(row => {
          const diferenca = parseFloat((row.peso_atual - row.peso_inicial).toFixed(2));
          const percentual_perda = row.peso_inicial > 0 
            ? parseFloat((((row.peso_inicial - row.peso_atual) / row.peso_inicial) * 100).toFixed(2))
            : 0;
          
          return {
            ...row,
            diferenca,
            percentual_perda
          };
        })
        .sort((a, b) => b.percentual_perda - a.percentual_perda) // Ordenar por maior percentual de perda
        .map((row, index) => ({
          ...row,
          posicao: index + 1
        }));
        
        res.json({ ranking });
      });
    }
  );
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

// Atualizar altura do usuário
app.put('/api/usuarios/altura', requireAuth, (req, res) => {
  console.log('📏 Requisição PUT /api/usuarios/altura recebida');
  console.log('Session ID:', req.sessionID);
  console.log('Usuario ID:', req.session.userId);
  console.log('Body:', req.body);
  
  const { altura } = req.body;
  const usuario_id = req.session.userId;
  
  if (!altura) {
    console.log('❌ Erro: Altura não fornecida');
    return res.status(400).json({ error: 'Altura é obrigatória' });
  }

  const alturaNum = parseFloat(altura);
  if (isNaN(alturaNum) || alturaNum <= 0 || alturaNum > 3) {
    console.log('❌ Erro: Altura inválida:', alturaNum);
    return res.status(400).json({ error: 'Altura inválida' });
  }

  console.log('💾 Salvando altura:', alturaNum, 'para usuário:', usuario_id);
  
  db.run(
    'UPDATE usuarios SET altura = ? WHERE id = ?',
    [alturaNum, usuario_id],
    function(err) {
      if (err) {
        console.log('❌ Erro ao salvar no banco:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log('✅ Altura salva com sucesso! Linhas afetadas:', this.changes);
      res.json({ 
        success: true,
        message: 'Altura atualizada com sucesso!',
        altura: alturaNum
      });
    }
  );
});

// ==================== ROTAS DE PERFORMANCE (RPs) ====================

app.get('/api/performance/rps', requireAuth, (req, res) => {
  db.get(
    'SELECT id, rp_5k, rp_10k, rp_21k, rp_42k, rp_5k_status, rp_10k_status, rp_21k_status, rp_42k_status FROM usuarios WHERE id = ?',
    [req.session.userId],
    (err, usuario) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const score = calculatePerformanceScore(usuario);
      return res.json({
        rp_5k: usuario.rp_5k ?? null,
        rp_10k: usuario.rp_10k ?? null,
        rp_21k: usuario.rp_21k ?? null,
        rp_42k: usuario.rp_42k ?? null,
        rp_5k_status: usuario.rp_5k_status || null,
        rp_10k_status: usuario.rp_10k_status || null,
        rp_21k_status: usuario.rp_21k_status || null,
        rp_42k_status: usuario.rp_42k_status || null,
        rp_5k_formatado: formatSecondsToRaceTime(usuario.rp_5k),
        rp_10k_formatado: formatSecondsToRaceTime(usuario.rp_10k),
        rp_21k_formatado: formatSecondsToRaceTime(usuario.rp_21k),
        rp_42k_formatado: formatSecondsToRaceTime(usuario.rp_42k),
        ritmo_medio_seg_km: score,
        ritmo_medio_formatado: formatPace(score)
      });
    }
  );
});

app.put('/api/performance/rps', requireAuth, (req, res) => {
  const payload = req.body || {};
  const parsed = {};

  for (const column of RACE_COLUMNS) {
    const seconds = parseRaceTimeToSeconds(payload[column]);

    if (Number.isNaN(seconds)) {
      return res.status(400).json({ error: `Valor inválido para ${column}. Use mm:ss ou hh:mm:ss` });
    }

    if (seconds !== null && (seconds < 300 || seconds > 21600)) {
      return res.status(400).json({ error: `Valor fora da faixa para ${column}` });
    }

    parsed[column] = seconds;
  }

  db.get(
    'SELECT rp_5k, rp_10k, rp_21k, rp_42k, rp_5k_status, rp_10k_status, rp_21k_status, rp_42k_status FROM usuarios WHERE id = ?',
    [req.session.userId],
    (selectErr, usuarioAtual) => {
      if (selectErr) {
        return res.status(500).json({ error: selectErr.message });
      }

      if (!usuarioAtual) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const nextStatuses = {};
      for (const column of RACE_COLUMNS) {
        const statusColumn = RP_STATUS_COLUMNS[column];
        const novoValor = parsed[column];
        const valorAtual = usuarioAtual[column] === null || usuarioAtual[column] === undefined
          ? null
          : Number(usuarioAtual[column]);
        const statusAtual = usuarioAtual[statusColumn] || null;

        if (novoValor === null) {
          nextStatuses[statusColumn] = null;
          continue;
        }

        if (valorAtual === novoValor && statusAtual) {
          nextStatuses[statusColumn] = statusAtual;
          continue;
        }

        nextStatuses[statusColumn] = 'pendente';
      }

      db.run(
        `UPDATE usuarios
         SET rp_5k = ?, rp_10k = ?, rp_21k = ?, rp_42k = ?,
             rp_5k_status = ?, rp_10k_status = ?, rp_21k_status = ?, rp_42k_status = ?
         WHERE id = ?`,
        [
          parsed.rp_5k,
          parsed.rp_10k,
          parsed.rp_21k,
          parsed.rp_42k,
          nextStatuses.rp_5k_status,
          nextStatuses.rp_10k_status,
          nextStatuses.rp_21k_status,
          nextStatuses.rp_42k_status,
          req.session.userId
        ],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          return res.json({
            success: true,
            message: 'Recordes pessoais atualizados com sucesso!',
            rps: {
              rp_5k: parsed.rp_5k,
              rp_10k: parsed.rp_10k,
              rp_21k: parsed.rp_21k,
              rp_42k: parsed.rp_42k,
              rp_5k_status: nextStatuses.rp_5k_status,
              rp_10k_status: nextStatuses.rp_10k_status,
              rp_21k_status: nextStatuses.rp_21k_status,
              rp_42k_status: nextStatuses.rp_42k_status,
              rp_5k_formatado: formatSecondsToRaceTime(parsed.rp_5k),
              rp_10k_formatado: formatSecondsToRaceTime(parsed.rp_10k),
              rp_21k_formatado: formatSecondsToRaceTime(parsed.rp_21k),
              rp_42k_formatado: formatSecondsToRaceTime(parsed.rp_42k)
            }
          });
        }
      );
    }
  );
});

app.get('/api/performance/grupos', requireAuth, (req, res) => {
  db.all(
    'SELECT id, nome, rp_5k, rp_10k, rp_21k, rp_42k FROM usuarios',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const usuarioLogado = rows.find((row) => row.id === req.session.userId);
      if (!usuarioLogado) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const meuScore = calculatePerformanceScore(usuarioLogado);
      if (meuScore === null) {
        return res.json({
          meu_nivel: null,
          grupos: {
            mesmo_nivel: [],
            nivel_mais_alto: [],
            nivel_mais_baixo: []
          },
          aviso: 'Cadastre ao menos um RP para gerar seus grupos de treino.'
        });
      }

      const candidatos = rows
        .filter((row) => row.id !== req.session.userId)
        .map((row) => ({ row, score: calculatePerformanceScore(row) }))
        .filter((item) => item.score !== null)
        .map((item) => mapRunnerForGroup(item.row, meuScore));

      const sameThreshold = 6;
      const mesmoNivel = candidatos
        .filter((item) => Math.abs(item.diferenca_percentual) <= sameThreshold)
        .sort((a, b) => Math.abs(a.diferenca_percentual) - Math.abs(b.diferenca_percentual));

      const nivelMaisAlto = candidatos
        .filter((item) => item.diferenca_percentual < -sameThreshold)
        .sort((a, b) => a.ritmo_medio_seg_km - b.ritmo_medio_seg_km);

      const nivelMaisBaixo = candidatos
        .filter((item) => item.diferenca_percentual > sameThreshold)
        .sort((a, b) => a.diferenca_percentual - b.diferenca_percentual);

      return res.json({
        meu_nivel: {
          ritmo_medio_seg_km: meuScore,
          ritmo_medio_formatado: formatPace(meuScore)
        },
        grupos: {
          mesmo_nivel: mesmoNivel,
          nivel_mais_alto: nivelMaisAlto,
          nivel_mais_baixo: nivelMaisBaixo
        }
      });
    }
  );
});

app.get('/api/treinador/usuarios-ativos', requireAuth, requireTrainer, (req, res) => {
  const query = `
    SELECT
      u.id,
      u.nome,
      u.email,
      u.altura,
      u.rp_5k,
      u.rp_10k,
      u.rp_21k,
      u.rp_42k,
      u.rp_5k_status,
      u.rp_10k_status,
      u.rp_21k_status,
      u.rp_42k_status,
      p.peso AS peso_atual,
      p.data_pesagem,
      p.gordura_percentual,
      p.massa_muscular_percentual,
      p.agua_percentual,
      p.massa_ossea,
      p.metabolismo_basal,
      p.idade_metabolica,
      p.gordura_visceral
    FROM usuarios u
    LEFT JOIN pesagens p ON p.id = (
      SELECT p2.id
      FROM pesagens p2
      WHERE p2.usuario_id = u.id AND p2.excluido = 0
      ORDER BY p2.data_pesagem DESC, p2.id DESC
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1
      FROM pesagens p3
      WHERE p3.usuario_id = u.id AND p3.excluido = 0
    )
    ORDER BY u.nome ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const usuarios = (rows || []).map((row) => {
      const altura = row.altura === null || row.altura === undefined ? null : Number(row.altura);
      const pesoAtual = row.peso_atual === null || row.peso_atual === undefined ? null : Number(row.peso_atual);
      const imc = altura && pesoAtual && altura > 0
        ? Number((pesoAtual / (altura * altura)).toFixed(2))
        : null;

      return {
        usuario_id: row.id,
        nome: row.nome,
        email: row.email,
        altura,
        peso_atual: pesoAtual,
        imc,
        data_pesagem: row.data_pesagem || null,
        bioimpedancia: {
          gordura_percentual: row.gordura_percentual ?? null,
          massa_muscular_percentual: row.massa_muscular_percentual ?? null,
          agua_percentual: row.agua_percentual ?? null,
          massa_ossea: row.massa_ossea ?? null,
          metabolismo_basal: row.metabolismo_basal ?? null,
          idade_metabolica: row.idade_metabolica ?? null,
          gordura_visceral: row.gordura_visceral ?? null
        },
        rps: {
          rp_5k: row.rp_5k ?? null,
          rp_10k: row.rp_10k ?? null,
          rp_21k: row.rp_21k ?? null,
          rp_42k: row.rp_42k ?? null,
          rp_5k_formatado: formatSecondsToRaceTime(row.rp_5k),
          rp_10k_formatado: formatSecondsToRaceTime(row.rp_10k),
          rp_21k_formatado: formatSecondsToRaceTime(row.rp_21k),
          rp_42k_formatado: formatSecondsToRaceTime(row.rp_42k),
          rp_5k_status: row.rp_5k_status || null,
          rp_10k_status: row.rp_10k_status || null,
          rp_21k_status: row.rp_21k_status || null,
          rp_42k_status: row.rp_42k_status || null
        }
      };
    });

    return res.json({ usuarios });
  });
});

app.put('/api/treinador/rps/:usuarioId/aprovacao', requireAuth, requireTrainer, (req, res) => {
  const usuarioId = parseInt(req.params.usuarioId, 10);
  const { prova, status } = req.body || {};

  if (!usuarioId || Number.isNaN(usuarioId)) {
    return res.status(400).json({ error: 'Usuário inválido' });
  }

  if (!RACE_COLUMNS.includes(prova)) {
    return res.status(400).json({ error: 'Prova de RP inválida' });
  }

  if (!RP_APPROVAL_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use pendente, aprovado ou reprovado' });
  }

  const statusColumn = RP_STATUS_COLUMNS[prova];

  db.get(
    `SELECT id, ${prova} AS valor_rp FROM usuarios WHERE id = ?`,
    [usuarioId],
    (selectErr, usuario) => {
      if (selectErr) {
        return res.status(500).json({ error: selectErr.message });
      }

      if (!usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      if (usuario.valor_rp === null || usuario.valor_rp === undefined) {
        return res.status(400).json({ error: 'Este usuário não possui RP cadastrado para a prova selecionada' });
      }

      db.run(
        `UPDATE usuarios SET ${statusColumn} = ? WHERE id = ?`,
        [status, usuarioId],
        function(updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
          }

          return res.json({
            success: true,
            message: `RP ${prova} atualizado para ${status}`,
            usuario_id: usuarioId,
            prova,
            status
          });
        }
      );
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

if (APP_BASE_PATH !== CONTROL_COMPAT_BASE) {
  app.get([CONTROL_COMPAT_BASE, `${CONTROL_COMPAT_BASE}/`], (req, res) => {
    if (!req.session.userId) {
      return res.redirect(basePath('/login'));
    }
    return res.redirect(basePath('/home'));
  });

  const compatRoutes = [
    '/login',
    '/cadastro',
    '/recuperar-senha',
    '/home',
    '/pesagem',
    '/ranking',
    '/grupos-treino',
    '/parceiros',
    '/bioimpedancia',
    '/treinador'
  ];

  compatRoutes.forEach((route) => {
    app.get(`${CONTROL_COMPAT_BASE}${route}`, (req, res) => {
      return res.redirect(basePath(route));
    });
  });
}

app.get([APP_BASE_PATH, `${APP_BASE_PATH}/`], (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  return res.redirect(basePath('/home'));
});

// Página de login
app.get('/login', (req, res) => {
  res.redirect(basePath('/login'));
});

app.get(basePath('/login'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Página de cadastro
app.get('/cadastro', (req, res) => {
  res.redirect(basePath('/cadastro'));
});

app.get(basePath('/cadastro'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

// Página de recuperação de senha
app.get('/recuperar-senha', (req, res) => {
  res.redirect(basePath('/recuperar-senha'));
});

app.get(basePath('/recuperar-senha'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recuperar-senha.html'));
});

// Página home (requer autenticação)
app.get('/home', (req, res) => {
  res.redirect(basePath('/home'));
});

app.get(basePath('/home'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Página de pesagem (requer autenticação)
app.get('/pesagem', (req, res) => {
  res.redirect(basePath('/pesagem'));
});

app.get(basePath('/pesagem'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  res.sendFile(path.join(__dirname, 'public', 'pesagem.html'));
});

// Página de ranking (requer autenticação)
app.get('/ranking', (req, res) => {
  res.redirect(basePath('/ranking'));
});

app.get(basePath('/ranking'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  res.sendFile(path.join(__dirname, 'public', 'ranking.html'));
});

// Página de grupos de treino (requer autenticação)
app.get('/grupos-treino', (req, res) => {
  res.redirect(basePath('/grupos-treino'));
});

app.get(basePath('/grupos-treino'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  res.sendFile(path.join(__dirname, 'public', 'grupos-treino.html'));
});

// Compatibilidade com links antigos
app.get('/parceiros', (req, res) => {
  res.redirect(basePath('/grupos-treino'));
});

app.get(basePath('/parceiros'), (req, res) => {
  res.redirect(basePath('/grupos-treino'));
});

// Página de bioimpedância (requer autenticação)
app.get('/bioimpedancia', (req, res) => {
  res.redirect(basePath('/bioimpedancia'));
});

app.get(basePath('/bioimpedancia'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  res.sendFile(path.join(__dirname, 'public', 'bioimpedancia.html'));
});

// Página do treinador (exclusiva)
app.get('/treinador', (req, res) => {
  res.redirect(basePath('/treinador'));
});

app.get(basePath('/treinador'), requireTrainerPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'treinador.html'));
});

// Página principal (redireciona para home)
app.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.redirect(basePath('/login'));
  }
  res.redirect(basePath('/home'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🏃‍♂️ Sistema de Controle de Peso Age Run`);
});

module.exports = app;
