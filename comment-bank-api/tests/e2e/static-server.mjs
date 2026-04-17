import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../public');
const port = Number(process.env.PLAYWRIGHT_PORT || 41844);
const host = '127.0.0.1';

const app = express();
app.use(express.static(publicDir));

const server = app.listen(port, host, () => {
  console.log(`Playwright static server listening at http://${host}:${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
