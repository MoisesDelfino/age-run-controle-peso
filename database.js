const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Detectar ambiente
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = process.env.DATABASE_URL || isProduction;

let db;

if (usePostgres) {
  // PostgreSQL para produção
  console.log('🐘 Usando PostgreSQL');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? {
      rejectUnauthorized: false
    } : false
  });

  const normalizeArgs = (params, callback) => {
    if (typeof params === 'function') {
      return { params: [], callback: params };
    }
    return { params: params || [], callback };
  };

  // Wrapper para manter compatibilidade com sintaxe SQLite
  db = {
    run: (sql, params, callback) => {
      const normalized = normalizeArgs(params, callback);
      const pgSql = sql.replace(/\?/g, (match, offset) => {
        const index = sql.substring(0, offset).split('?').length;
        return `$${index}`;
      });
      
      pool.query(pgSql, normalized.params)
        .then(result => {
          if (normalized.callback) {
            normalized.callback.call({ lastID: result.rows[0]?.id, changes: result.rowCount }, null);
          }
        })
        .catch(err => {
          if (normalized.callback) normalized.callback(err);
        });
    },
    
    get: (sql, params, callback) => {
      const normalized = normalizeArgs(params, callback);
      const pgSql = sql.replace(/\?/g, (match, offset) => {
        const index = sql.substring(0, offset).split('?').length;
        return `$${index}`;
      });
      
      pool.query(pgSql, normalized.params)
        .then(result => normalized.callback(null, result.rows[0]))
        .catch(err => normalized.callback(err));
    },
    
    all: (sql, params, callback) => {
      const normalized = normalizeArgs(params, callback);
      const pgSql = sql.replace(/\?/g, (match, offset) => {
        const index = sql.substring(0, offset).split('?').length;
        return `$${index}`;
      });
      
      pool.query(pgSql, normalized.params)
        .then(result => normalized.callback(null, result.rows))
        .catch(err => normalized.callback(err));
    },
    
    serialize: (callback) => {
      callback();
    }
  };
  
  // Conectar e inicializar banco
  pool.connect()
    .then(() => {
      console.log('✅ Conectado ao banco de dados PostgreSQL');
      initDatabase();
    })
    .catch(err => {
      console.error('❌ Erro ao conectar ao PostgreSQL:', err.message);
    });
  
} else {
  // SQLite para desenvolvimento
  console.log('📁 Usando SQLite (desenvolvimento)');
  
  const dbPath = path.join(__dirname, 'peso.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    } else {
      console.log('✅ Conectado ao banco de dados SQLite');
      initDatabase();
    }
  });
}

// Inicializar tabelas
function initDatabase() {
  db.serialize(() => {
    // Tabela de usuários
    const createUsersTable = usePostgres ? `
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        sexo TEXT DEFAULT 'masculino',
        altura REAL,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        codigo_recuperacao TEXT,
        codigo_expiracao TIMESTAMP
      )
    ` : `
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        sexo TEXT DEFAULT 'masculino',
        altura REAL,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        codigo_recuperacao TEXT,
        codigo_expiracao DATETIME
      )
    `;

    db.run(createUsersTable, (err) => {
      if (err) console.error('Erro ao criar tabela usuarios:', err);
    });

    const ensureAlturaColumn = usePostgres
      ? 'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS altura REAL'
      : 'ALTER TABLE usuarios ADD COLUMN altura REAL';

    db.run(ensureAlturaColumn, (err) => {
      if (err) {
        const message = err.message || '';
        const alreadyExists = message.includes('duplicate column name') || message.includes('already exists');
        if (!alreadyExists) {
          console.error('Erro ao garantir coluna altura:', err);
        }
      }
    });

    const ensureSexoColumn = usePostgres
      ? "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sexo TEXT DEFAULT 'masculino'"
      : "ALTER TABLE usuarios ADD COLUMN sexo TEXT DEFAULT 'masculino'";

    db.run(ensureSexoColumn, (err) => {
      if (err) {
        const message = err.message || '';
        const alreadyExists = message.includes('duplicate column name') || message.includes('already exists');
        if (!alreadyExists) {
          console.error('Erro ao garantir coluna sexo:', err);
        }
      }
    });

    const ensurePerfilColumn = usePostgres
      ? "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil TEXT DEFAULT 'aluno'"
      : "ALTER TABLE usuarios ADD COLUMN perfil TEXT DEFAULT 'aluno'";

    db.run(ensurePerfilColumn, (err) => {
      if (err) {
        const message = err.message || '';
        const alreadyExists = message.includes('duplicate column name') || message.includes('already exists');
        if (!alreadyExists) {
          console.error('Erro ao garantir coluna perfil:', err);
        }
      }
    });

    const rpColumns = [
      'rp_5k INTEGER',
      'rp_10k INTEGER',
      'rp_21k INTEGER',
      'rp_42k INTEGER'
    ];

    rpColumns.forEach((columnDef) => {
      const columnName = columnDef.split(' ')[0];
      const ensureColumnSql = usePostgres
        ? `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ${columnDef}`
        : `ALTER TABLE usuarios ADD COLUMN ${columnDef}`;

      db.run(ensureColumnSql, (err) => {
        if (err) {
          const message = err.message || '';
          const alreadyExists = message.includes('duplicate column name') || message.includes('already exists');
          if (!alreadyExists) {
            console.error(`Erro ao garantir coluna ${columnName}:`, err);
          }
        }
      });
    });

    const rpStatusColumns = [
      'rp_5k_status TEXT',
      'rp_10k_status TEXT',
      'rp_21k_status TEXT',
      'rp_42k_status TEXT'
    ];

    rpStatusColumns.forEach((columnDef) => {
      const columnName = columnDef.split(' ')[0];
      const ensureColumnSql = usePostgres
        ? `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ${columnDef}`
        : `ALTER TABLE usuarios ADD COLUMN ${columnDef}`;

      db.run(ensureColumnSql, (err) => {
        if (err) {
          const message = err.message || '';
          const alreadyExists = message.includes('duplicate column name') || message.includes('already exists');
          if (!alreadyExists) {
            console.error(`Erro ao garantir coluna ${columnName}:`, err);
          }
        }
      });
    });

    const backfillSexoSql = "UPDATE usuarios SET sexo = 'masculino' WHERE sexo IS NULL OR TRIM(sexo) = ''";
    db.run(backfillSexoSql, function(err) {
      if (err) {
        console.error('Erro ao atualizar sexo dos usuários antigos:', err);
        return;
      }

      if (this.changes > 0) {
        console.log(`👥 Usuários antigos atualizados para sexo masculino: ${this.changes}`);
      }
    });

    const backfillPerfilSql = "UPDATE usuarios SET perfil = 'aluno' WHERE perfil IS NULL OR TRIM(perfil) = ''";
    db.run(backfillPerfilSql, function(err) {
      if (err) {
        console.error('Erro ao atualizar perfil dos usuários antigos:', err);
        return;
      }

      if (this.changes > 0) {
        console.log(`🧭 Usuários antigos atualizados para perfil aluno: ${this.changes}`);
      }
    });

    // Tabela de pesagens
    const createWeighingsTable = usePostgres ? `
      CREATE TABLE IF NOT EXISTS pesagens (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        peso REAL NOT NULL,
        gordura_percentual REAL,
        massa_muscular_percentual REAL,
        agua_percentual REAL,
        massa_ossea REAL,
        metabolismo_basal INTEGER,
        idade_metabolica INTEGER,
        gordura_visceral INTEGER,
        data_pesagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        excluido INTEGER DEFAULT 0,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    ` : `
      CREATE TABLE IF NOT EXISTS pesagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        peso REAL NOT NULL,
        gordura_percentual REAL,
        massa_muscular_percentual REAL,
        agua_percentual REAL,
        massa_ossea REAL,
        metabolismo_basal INTEGER,
        idade_metabolica INTEGER,
        gordura_visceral INTEGER,
        data_pesagem DATETIME DEFAULT CURRENT_TIMESTAMP,
        excluido INTEGER DEFAULT 0,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `;

    db.run(createWeighingsTable, (err) => {
      if (err) console.error('Erro ao criar tabela pesagens:', err);
    });

    const bioColumns = [
      'gordura_percentual REAL',
      'massa_muscular_percentual REAL',
      'agua_percentual REAL',
      'massa_ossea REAL',
      'metabolismo_basal INTEGER',
      'idade_metabolica INTEGER',
      'gordura_visceral INTEGER'
    ];

    bioColumns.forEach((columnDef) => {
      const columnName = columnDef.split(' ')[0];
      const ensureColumnSql = usePostgres
        ? `ALTER TABLE pesagens ADD COLUMN IF NOT EXISTS ${columnDef}`
        : `ALTER TABLE pesagens ADD COLUMN ${columnDef}`;

      db.run(ensureColumnSql, (err) => {
        if (err) {
          const message = err.message || '';
          const alreadyExists = message.includes('duplicate column name') || message.includes('already exists');
          if (!alreadyExists) {
            console.error(`Erro ao garantir coluna ${columnName}:`, err);
          }
        }
      });
    });

    console.log('📊 Tabelas criadas/verificadas com sucesso');
  });
}

module.exports = db;
