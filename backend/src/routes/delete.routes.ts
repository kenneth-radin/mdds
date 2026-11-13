import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { softDeleteMaintenanceCase } from '../services/deleteService';
import { asyncHandler, HttpError } from '../middleware/error';

const router = Router();
router.use(requireAuth);

// PATCH /api/maintenance-cases/:id/delete — admin-only soft-delete
// 401 Unauthorized (no JWT)
// 403 Forbidden (wrong role)
// 404 Not Found (case doesn't exist)
// 200 Success
router.patch(
  '/maintenance-cases/:id/delete',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await softDeleteMaintenanceCase(
      req.params.id as string,
      req.auth?.role ?? 'viewer'
    );

    if (!result.success) {
      const status = result.message.startsWith('404')
        ? 404
        : result.message.startsWith('403')
        ? 403
        : 500;
      throw new HttpError(status, result.message);
    }

    res.json(result);
  })
);

export default router;