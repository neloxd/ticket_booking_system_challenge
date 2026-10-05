import { Router } from 'express';
import { createHoldSchema, joinWaitlistSchema } from '@ticket/shared';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as showService from './shows.service';
import * as seatService from '../seats/seats.service';
import * as holdService from '../holds/holds.service';
import * as waitlistService from '../waitlist/waitlist.service';

export const showsRouter = Router();

showsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => res.json(await showService.getShow(req.params.id))),
);

showsRouter.get(
  '/:id/seats',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(await seatService.getSeatMap(req.params.id, req.user?.id));
  }),
);

showsRouter.post(
  '/:id/holds',
  requireAuth,
  validateBody(createHoldSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await holdService.createHold(req.user!.id, req.params.id, req.body.seatIds));
  }),
);

showsRouter.post(
  '/:id/waitlist',
  requireAuth,
  validateBody(joinWaitlistSchema),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(await waitlistService.joinWaitlist(req.user!.id, req.params.id, req.body.seatCategoryId));
  }),
);

showsRouter.get(
  '/:id/waitlist/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await waitlistService.getMyWaitlist(req.user!.id, req.params.id));
  }),
);
