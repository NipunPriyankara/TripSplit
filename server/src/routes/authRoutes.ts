import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { config } from '../config/index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../types/shared.js';

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  avatar: z.string().optional().nullable(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

function generateToken(user: { id: string; email: string }) {
  return jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = RegisterSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { name, email, password, avatar } = parse.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, avatar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), normalizedEmail, passwordHash, avatar || null, now, now);

    const user: User = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      avatar: avatar || null,
      is_admin: 0,
      created_at: now,
      updated_at: now,
    };

    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register account.' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: (parse.error as any).errors?.[0]?.message || 'Invalid data' });
      return;
    }

    const { email, password } = parse.data;
    const normalizedEmail = email.toLowerCase().trim();

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as any;
    if (!row) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, row.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user: User = {
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar,
      is_admin: row.is_admin ? 1 : 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const token = generateToken(user);
    res.json({ user, token });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user });
});

// Update Profile (Name, Email, Profile Picture / Avatar)
const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  avatar: z.string().optional().nullable(),
});

router.put('/profile', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const parse = UpdateProfileSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: (parse.error as any).errors?.[0]?.message || 'Invalid data' });
      return;
    }

    const { name, email, avatar } = parse.data;
    const userId = req.user!.id;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if new email is taken by another account
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, userId);
    if (existing) {
      res.status(409).json({ error: 'This email is already in use by another account.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, avatar = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim(), normalizedEmail, avatar !== undefined ? avatar : req.user!.avatar, now, userId);

    const updatedUser: User = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      avatar: avatar !== undefined ? avatar : req.user!.avatar,
      is_admin: req.user!.is_admin,
      updated_at: now,
    };

    const token = generateToken(updatedUser);
    res.json({ user: updatedUser, token, message: 'Profile updated successfully' });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change Password
const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
});

router.put('/password', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parse = ChangePasswordSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { current_password, new_password } = parse.data;
    const userId = req.user!.id;

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any;
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(current_password, row.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, now, userId);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
