import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const port = Number(process.env.PORT ?? 4000);
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'vyona-api' }));
app.get('/api', (_req, res) => res.json({ name: 'VYONA AI API', version: '0.1.0' }));

app.listen(port, () => {
  console.log(`VYONA API listening on http://localhost:${port}`);
});
