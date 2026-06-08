import { Response } from 'express';
import { db } from '../../lib/db/connection.js';
import { mediaFiles } from '../../lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function uploadMedia(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const category = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const url = `/uploads/${req.file.filename}`;
    const description = typeof req.body.description === 'string' ? req.body.description : null;

    const [media] = await db.insert(mediaFiles).values({
      userId: req.user!.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url,
      category,
      description,
    }).returning();

    return res.status(201).json(media);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

export async function getMedia(req: AuthenticatedRequest, res: Response) {
  try {
    const files = req.user!.role === 'admin'
      ? await db.select().from(mediaFiles).orderBy(desc(mediaFiles.createdAt))
      : await db.select().from(mediaFiles).where(eq(mediaFiles.userId, req.user!.id)).orderBy(desc(mediaFiles.createdAt));

    return res.json(files);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function deleteMedia(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const existing = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: 'File not found' });

    if (req.user!.role !== 'admin' && existing[0].userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorised to delete this file' });
    }

    const filePath = path.join(__dirname, '../../../uploads', existing[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
