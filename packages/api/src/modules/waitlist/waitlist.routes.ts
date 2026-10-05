import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';
import * as waitlistService from './waitlist.service';

export const waitlistRouter = Router();

waitlistRouter.get(
  '/offers/:token',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await waitlistService.getOffer(req.user!.id, req.params.token));
  }),
);

waitlistRouter.post(
  '/offers/:token/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(201).json(await waitlistService.acceptOffer(req.user!.id, req.params.token));
  }),
);

waitlistRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await waitlistService.leaveWaitlist(req.user!.id, req.params.id);
    res.status(204).end();
  }),
);
