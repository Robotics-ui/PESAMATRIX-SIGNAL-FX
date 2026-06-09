import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { env } from '../config/env.js';
import { register, login, refresh, logout } from './controllers/auth.controller.js';
import { uploadMedia, getMedia, deleteMedia } from './controllers/media.controller.js';
import { getContacts, getAllContacts, createContact, updateContact, deleteContact } from './controllers/contacts.controller.js';
import { getSubscriptionSettings, updateSubscriptionSettings } from './controllers/admin.controller.js';
import { listMasterAccounts, adminListMasterAccounts, createMasterAccount, updateMasterAccount, deleteMasterAccount } from './controllers/masterAccounts.controller.js';
import { getSettings, purchaseSubscription, getMySubscription, subscribeToProvider, unsubscribeFromProvider } from './controllers/subscription.controller.js';
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

const allowedOrigins = process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(',').map((d) => `https://${d.trim()}`)
  : ['http://localhost:5000'];

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/uploads', express.static(uploadsDir));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pmatrix-api', timestamp: new Date().toISOString() });
});

// Auth
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/refresh', refresh);

// Current user — canonical path and backward-compatible alias
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});
app.get('/api/me', authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

// Logout — invalidate session in DB
app.post('/api/auth/logout', authenticateToken, logout as any);

// Media
app.post('/api/media/upload', authenticateToken, upload.single('file'), uploadMedia as any);
app.get('/api/media', authenticateToken, getMedia as any);
app.delete('/api/media/:id', authenticateToken, deleteMedia as any);

// Contacts
app.get('/api/contacts', authenticateToken, getContacts as any);
app.get('/api/contacts/all', authenticateToken, getAllContacts as any);
app.post('/api/contacts', authenticateToken, createContact as any);
app.put('/api/contacts/:id', authenticateToken, updateContact as any);
app.delete('/api/contacts/:id', authenticateToken, deleteContact as any);

// Subscription (user-facing)
app.get('/api/subscription/settings', authenticateToken, getSettings as any);
app.post('/api/subscription/purchase', authenticateToken, purchaseSubscription as any);
app.get('/api/subscription/my', authenticateToken, getMySubscription as any);
app.post('/api/subscription/provider', authenticateToken, subscribeToProvider as any);
app.delete('/api/subscription/provider', authenticateToken, unsubscribeFromProvider as any);

// Master accounts (user-facing: active only)
app.get('/api/master-accounts', authenticateToken, listMasterAccounts as any);

// Admin
app.get('/api/admin/subscription-settings', authenticateToken, getSubscriptionSettings as any);
app.put('/api/admin/subscription-settings', authenticateToken, updateSubscriptionSettings as any);
app.get('/api/admin/master-accounts', authenticateToken, adminListMasterAccounts as any);
app.post('/api/admin/master-accounts', authenticateToken, createMasterAccount as any);
app.put('/api/admin/master-accounts/:id', authenticateToken, updateMasterAccount as any);
app.delete('/api/admin/master-accounts/:id', authenticateToken, deleteMasterAccount as any);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = env.PORT;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PMatrix API server running on port ${PORT}`);
});

export default app;
