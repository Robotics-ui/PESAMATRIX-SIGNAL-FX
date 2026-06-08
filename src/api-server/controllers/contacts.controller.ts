import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { contacts } from '../../lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  whatsapp: z.string().optional().nullable(),
  label: z.string().default('Support'),
});

export async function getContacts(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await db.select().from(contacts)
      .where(eq(contacts.isActive, true))
      .orderBy(desc(contacts.createdAt));
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getAllContacts(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function createContact(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const parsed = contactSchema.parse(req.body);
    const [contact] = await db.insert(contacts).values({
      name: parsed.name,
      phone: parsed.phone,
      whatsapp: parsed.whatsapp || null,
      label: parsed.label,
    }).returning();

    return res.status(201).json(contact);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateContact(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { id } = req.params as { id: string };
    const parsed = contactSchema.partial().parse(req.body);

    const [updated] = await db.update(contacts)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}

export async function deleteContact(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { id } = req.params as { id: string };
    await db.update(contacts).set({ isActive: false, updatedAt: new Date() }).where(eq(contacts.id, id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
