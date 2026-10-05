import { Router } from 'express';
import { createBookingSchema } from '@ticket/shared';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as bookingService from './bookings.service';

export const bookingsRouter = Router();

bookingsRouter.post(
  '/',
  requireAuth,
  validateBody(createBookingSchema),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(await bookingService.createBooking(req.user!.id, req.body.holdId, req.body.paymentToken));
  }),
);

bookingsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await bookingService.listBookings(req.user!.id));
  }),
);

bookingsRouter.get(
  '/:reference',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await bookingService.getBookingByReference(req.params.reference, req.user!.id));
  }),
);

bookingsRouter.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await bookingService.cancelBooking(req.user!.id, req.params.id));
  }),
);
