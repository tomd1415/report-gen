import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import { config } from './config/env.js';
import { sequelize } from './db/sequelize.js';
import { models } from './models/index.js';
import { openai } from './services/openai.js';
import { registerRoutes } from './routes/index.js';

const SequelizeStore = connectSessionSequelize(session.Store);

export async function createApp() {
  const app = express();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const sessionStore = new SequelizeStore({
    db: sequelize,
    tableName: 'Sessions',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: config.session.maxAgeMs
  });

  if (config.session.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(cors());
  app.use(express.json());
  app.use(session({
    store: sessionStore,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    name: config.session.name,
    cookie: {
      httpOnly: true,
      secure: config.session.secure,
      sameSite: config.session.sameSite,
      maxAge: config.session.maxAgeMs
    }
  }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  registerRoutes(app, { models, openai });

  return app;
}
