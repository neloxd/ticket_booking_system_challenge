import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mailer', () => ({ sendMail: vi.fn(async () => {}) }));

import { createHold } from '../src/modules/holds/holds.service';
import { createBooking, cancelBooking } from '../src/modules/bookings/bookings.service';
import {
  joinWaitlist,
  acceptOffer,
  processExpiredOffers,
} from '../src/modules/waitlist/waitlist.service';
import { prisma } from '../src/lib/prisma';
import { SeatStatus, WaitlistStatus, OfferStatus, BookingStatus } from '@ticket/shared';
import { createShowFixture, createUser } from './helpers';

async function bookAllSeats(userId: string, showId: string, seatIds: string[]) {
  const hold = await createHold(userId, showId, seatIds);
  return createBooking(userId, hold.id, 'tok_ok');
}

describe('waitlist offer flow', () => {
  it('offers a freed seat to the next in line on cancellation, and converts on accept', async () => {
    const { show, categoryId, showSeatIds } = await createShowFixture({ seats: 2 });
    const alice = await createUser('CUSTOMER');
    const bob = await createUser('CUSTOMER');

    const booking = await bookAllSeats(alice.id, show.id, showSeatIds);
    await joinWaitlist(bob.id, show.id, categoryId);

    await cancelBooking(alice.id, booking.id);

    const offer = await prisma.waitlistOffer.findFirst({
      where: { waitlistEntry: { userId: bob.id, showId: show.id } },
      orderBy: { createdAt: 'desc' },
    });
    expect(offer).toBeTruthy();
    expect(offer!.status).toBe(OfferStatus.PENDING);

    const reserved = await prisma.showSeat.findUnique({ where: { id: offer!.showSeatId } });
    expect(reserved?.status).toBe(SeatStatus.HELD);

    const bobBooking = await acceptOffer(bob.id, offer!.offerToken);
    expect(bobBooking.status).toBe(BookingStatus.CONFIRMED);

    const booked = await prisma.showSeat.findUnique({ where: { id: offer!.showSeatId } });
    expect(booked?.status).toBe(SeatStatus.BOOKED);

    const entry = await prisma.waitlistEntry.findFirst({
      where: { userId: bob.id, showId: show.id },
    });
    expect(entry?.status).toBe(WaitlistStatus.CONVERTED);
  });

  it('re-offers to the next in line when an offer expires', async () => {
    const { show, categoryId, showSeatIds } = await createShowFixture({ seats: 1 });
    const alice = await createUser('CUSTOMER');
    const bob = await createUser('CUSTOMER');
    const carol = await createUser('CUSTOMER');

    const booking = await bookAllSeats(alice.id, show.id, showSeatIds);
    await joinWaitlist(bob.id, show.id, categoryId);
    await new Promise((r) => setTimeout(r, 10));
    await joinWaitlist(carol.id, show.id, categoryId);

    await cancelBooking(alice.id, booking.id);
    const bobOffer = await prisma.waitlistOffer.findFirst({
      where: { waitlistEntry: { userId: bob.id } },
      orderBy: { createdAt: 'desc' },
    });
    expect(bobOffer).toBeTruthy();

    await prisma.waitlistOffer.update({
      where: { id: bobOffer!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const processed = await processExpiredOffers();
    expect(processed).toBeGreaterThanOrEqual(1);

    const bobAfter = await prisma.waitlistOffer.findUnique({ where: { id: bobOffer!.id } });
    expect(bobAfter?.status).toBe(OfferStatus.EXPIRED);
    const bobEntry = await prisma.waitlistEntry.findFirst({ where: { userId: bob.id } });
    expect(bobEntry?.status).toBe(WaitlistStatus.EXPIRED);

    const carolOffer = await prisma.waitlistOffer.findFirst({
      where: { waitlistEntry: { userId: carol.id } },
      orderBy: { createdAt: 'desc' },
    });
    expect(carolOffer).toBeTruthy();
    expect(carolOffer!.status).toBe(OfferStatus.PENDING);
    const seat = await prisma.showSeat.findUnique({ where: { id: showSeatIds[0] } });
    expect(seat?.status).toBe(SeatStatus.HELD);
  });

  it('releases the freed seat to AVAILABLE when nobody is waiting', async () => {
    const { show, showSeatIds } = await createShowFixture({ seats: 1 });
    const alice = await createUser('CUSTOMER');

    const booking = await bookAllSeats(alice.id, show.id, showSeatIds);
    await cancelBooking(alice.id, booking.id);

    const seat = await prisma.showSeat.findUnique({ where: { id: showSeatIds[0] } });
    expect(seat?.status).toBe(SeatStatus.AVAILABLE);
  });
});
