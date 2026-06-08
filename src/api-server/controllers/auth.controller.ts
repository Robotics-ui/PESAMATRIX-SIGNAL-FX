import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { users, sessions } from '../../lib/db/schema.js';
import { eq, or } from 'drizzle-orm';
import { env } from '../../config/env.js';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.parse(req.body);

    const existing = await db.select().from(users).where(
      or(eq(users.email, parsed.email), eq(users.phoneNumber, parsed.phoneNumber))
    ).limit(1);

    if (existing.length) {
      const conflict = existing[0].email === parsed.email ? 'email' : 'phone number';
      return res.status(400).json({ error: `This ${conflict} is already registered.` });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const [newUser] = await db.insert(users).values({
      fullName: parsed.fullName,
      email: parsed.email,
      phoneNumber: parsed.phoneNumber,
      passwordHash,
      role: 'user',
    }).returning();

    return res.status(201).json({ id: newUser.id, email: newUser.email, role: newUser.role });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Registration failed' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const loginSchema = z.object({ email: z.string().email(), password: z.string() });
    const parsed = loginSchema.parse(req.body);

    const matched = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
    if (matched.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = matched[0];
    if (!user.isActive) return res.status(403).json({ error: 'Account is locked.' });

    const validPassword = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign({ id: user.id, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(sessions).values({ userId: user.id, refreshToken, expiresAt });

    return res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required.' });

  try {
    const storedToken = await db.select().from(sessions).where(eq(sessions.refreshToken, refreshToken)).limit(1);
    if (storedToken.length === 0 || new Date() > storedToken[0].expiresAt) {
      return res.status(403).json({ error: 'Token expired or invalid.' });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
    const matchedUser = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
    if (matchedUser.length === 0) return res.status(403).json({ error: 'User not found.' });

    const newAccessToken = jwt.sign(
      { id: matchedUser[0].id, role: matchedUser[0].role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(403).json({ error: 'Invalid token.' });
  }
}
