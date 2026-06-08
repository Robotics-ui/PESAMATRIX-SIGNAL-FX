import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { env } from '../config/env.js';
import { register, login, refresh } from './controllers/auth.controller.js';
import { uploadMedia, getMedia, deleteMedia } from './controllers/media.controller.js';
import { getContacts, getAllContacts, createContact, updateContact, deleteContact } from './controllers/contacts.controller.js';
import { authenticateToken } from './middlewares/auth.js';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|ogg|mov|avi)/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only images and videos are allowed'));
  },
});

const app = express();

app.use(cors({
  origin: 'https://pesamatrix-signal-fx-f--signalfx.replit.app',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}));

app.options(/.*/, cors({
  origin: 'https://pesamatrix-signal-fx-f--signalfx.replit.app',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/uploads', express.static(uploadsDir));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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

app.post('/api/media/upload', authenticateToken, upload.single('file'), uploadMedia as any);
app.get('/api/media', authenticateToken, getMedia as any);
app.delete('/api/media/:id', authenticateToken, deleteMedia as any);

app.get('/api/contacts', authenticateToken, getContacts as any);
app.get('/api/contacts/all', authenticateToken, getAllContacts as any);
app.post('/api/contacts', authenticateToken, createContact as any);
app.put('/api/contacts/:id', authenticateToken, updateContact as any);
app.delete('/api/contacts/:id', authenticateToken, deleteContact as any);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = env.PORT;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PMatrix API server running on port ${PORT}`);
});

export default app;
