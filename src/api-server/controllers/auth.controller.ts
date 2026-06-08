import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { users, sessions } from '../../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'provider', 'user']).default('user')
});

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const [newUser] = await db.insert(users).values({
      email: parsed.email,
      passwordHash,
      role: parsed.role,
    }).returning();

    return res.status(201).json({ id: newUser.id, email: newUser.email, role: newUser.role });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Registration structural payload error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const loginSchema = z.object({ email: z.string().email(), password: z.string() });
    const parsed = loginSchema.parse(req.body);

    const matched = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
    if (matched.length === 0) return res.status(401).json({ error: 'Invalid Credentials' });

    const user = matched[0];
    if (!user.isActive) return res.status(403).json({ error: 'This user identity has been locked.' });

    const validPassword = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid Credentials' });

    const accessToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(sessions).values({ userId: user.id, refreshToken, expiresAt });

    return res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token mandatory context configuration missing.' });

  try {
    const storedToken = await db.select().from(sessions).where(eq(sessions.refreshToken, refreshToken)).limit(1);
    if (storedToken.length === 0 || new Date() > storedToken[0].expiresAt) {
      return res.status(403).json({ error: 'Token expired or vanished from identity ledger' });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
    const matchedUser = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
    if (matchedUser.length === 0) return res.status(403).json({ error: 'User does not exist inside matrix context' });

    const newAccessToken = jwt.sign({ id: matchedUser[0].id, role: matchedUser[0].role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(403).json({ error: 'Malformed verification token matrix mapping mismatch error' });
  }
}
