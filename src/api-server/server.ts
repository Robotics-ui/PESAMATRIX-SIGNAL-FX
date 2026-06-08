import express from 'express';
import { env } from '../config/env.js';
import { register, login, refresh } from './controllers/auth.controller.js';
import { authenticateToken } from './middlewares/auth.js';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pmatrix-api', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/refresh', refresh);

app.get('/api/me', authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = env.PORT;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PMatrix API server running on port ${PORT}`);
});

export default app;
