import dotenv from 'dotenv';

dotenv.config();

const toBool = (value, fallback = false) => {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === 'true';
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const env = process.env.NODE_ENV || 'development';
const sessionSecret = process.env.SESSION_SECRET || process.env.SECRET_KEY || 'dev-insecure-secret';

if (sessionSecret === 'dev-insecure-secret') {
  console.warn('SESSION_SECRET/SECRET_KEY not set; using insecure dev secret.');
}

export const config = {
  env,
  port: toInt(process.env.PORT, 44344),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'mariadb',
    logging: toBool(process.env.DB_LOGGING, false)
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-5.2',
    reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'none'
  },
  session: {
    secret: sessionSecret,
    secure: toBool(process.env.SESSION_SECURE, false),
    sameSite: process.env.SESSION_SAMESITE || 'lax',
    name: process.env.SESSION_NAME || 'reportgen.sid',
    maxAgeMs: toInt(process.env.SESSION_MAX_AGE_MS, 14 * 24 * 60 * 60 * 1000),
    trustProxy: toBool(process.env.SESSION_TRUST_PROXY, false)
  },
  backup: {
    enabled: toBool(process.env.ENABLE_DB_BACKUP, false),
    dir: process.env.DB_BACKUP_DIR || './dbbackup_web'
  }
};
