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

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Secrets that are published somewhere: this file's own fallback, and the
 * placeholder in `.env.example`. Anyone can read both, so either one means the
 * session cookie can be forged.
 *
 * Deliberately a list of KNOWN-BAD values rather than a strength test. A minimum
 * length would also reject a short-but-random secret and take down a working
 * deployment on its next restart for something that is not actually a hole — and
 * the owner named exactly that risk when asking for this. Weak-but-unpublished
 * secrets get a warning below instead.
 */
const PUBLISHED_SESSION_SECRETS = new Set(['dev-insecure-secret', 'change-me']);

if (sessionSecret === 'dev-insecure-secret') {
  console.warn('SESSION_SECRET/SECRET_KEY not set; using insecure dev secret.');
} else if (sessionSecret.length < 32) {
  // A warning, not a refusal — see the note above on why this is not fatal.
  console.warn(`SESSION_SECRET is only ${sessionSecret.length} characters; 32 or more is recommended.`);
}

// Fail closed in production, and say precisely what to do about it. This runs at
// import, so the process exits before it can serve a request — which is the
// point: a warning on a boot log nobody reads is not a mitigation.
//
// It also means an existing deployment missing either value will REFUSE TO START
// on its next restart. That is the intended behaviour and was the owner's call;
// docs/release_checklist.md carries the warning where an operator will meet it.
if (env === 'production') {
  const problems = [];

  if (PUBLISHED_SESSION_SECRETS.has(sessionSecret)) {
    problems.push(
      'SESSION_SECRET is unset or still set to a published placeholder. Anyone who can read '
      + 'this project can forge a login cookie. Set it to a long random value, for example:\n'
      + '    SESSION_SECRET=$(openssl rand -base64 32)'
    );
  }

  if (allowedOrigins.length === 0) {
    problems.push(
      'CORS_ORIGINS is empty. An empty allow-list blocks every cross-origin request, which is '
      + 'safe but silent — the frontend simply stops working and looks broken rather than '
      + 'misconfigured. Set it to the live origin, for example:\n'
      + '    CORS_ORIGINS=https://reportgen.org.uk'
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n\n`
      + problems.map((problem) => `  * ${problem}`).join('\n\n')
      + `\n\nFix these in comment-bank-api/.env and restart. `
      + `To run without them, start with NODE_ENV=development.`
    );
  }
}

export const config = {
  env,
  port: toInt(process.env.PORT, 44344),
  cors: {
    allowedOrigins
  },
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
  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 30)
  },
  authRateLimit: {
    windowMs: toInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.AUTH_RATE_LIMIT_MAX, 20)
  },
  backup: {
    enabled: toBool(process.env.ENABLE_DB_BACKUP, false),
    dir: process.env.DB_BACKUP_DIR || './dbbackup_web'
  },
  auth: {
    allowRegistrationInProd: toBool(process.env.ALLOW_REGISTRATION_IN_PROD, false)
  }
};
