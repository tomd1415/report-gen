#!/usr/bin/env node

import { config } from './src/config/env.js';
import { runMigrations } from './src/db/migrate.js';
import { createApp } from './src/app.js';

await runMigrations();
const app = await createApp();

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});
