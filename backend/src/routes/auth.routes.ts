import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User';
import { asyncHandler, HttpError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['admin', 'technician', 'viewer']).optional(),
  title: z.string().optional()
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

function publicUser(user: { _id: unknown; name: string; email: string; username: string; role: string; title: string }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    title: user.title
  };
}

router.post(
  '/auth/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>;
    const existing = await User.findOne({
      $or: [{ email: body.email.toLowerCase() }, { username: body.username.toLowerCase() }]
    });
    if (existing) throw new HttpError(409, 'An account with that email or username already exists.');

    const count = await User.countDocuments({});
    const role = body.role || (count === 0 ? 'admin' : 'technician');

    const user = await User.create({
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      username: body.username.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(body.password, 10),
      role,
      title: body.title?.trim() || ''
    });

    const token = signToken({ userId: String(user._id), role: user.role });
    res.status(201).json({ token, user: publicUser(user) });
  })
);

router.post(
  '/auth/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof loginSchema>;
    const id = body.identifier.toLowerCase().trim();
    const user = await User.findOne({ $or: [{ email: id }, { username: id }] });
    if (!user) throw new HttpError(401, 'No account found for that email or username.');
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Incorrect password.');
    const token = signToken({ userId: String(user._id), role: user.role });
    res.json({ token, user: publicUser(user) });
  })
);

router.get(
  '/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw new HttpError(401, 'Account no longer exists.');
    res.json({ user: publicUser(user) });
  })
);

export default router;
