import { prisma } from '../../lib/prisma';
import { notFound, forbidden } from '../../lib/errors';
import { verifyTicketToken } from '../../lib/jwt';
import { generateQrDataUrl } from '../../lib/qr';
import { BookingStatus, type TicketVerifyDTO } from '@ticket/shared';

export async function getTicketQr(
  reference: string,
  userId: string,
): Promise<{ reference: string; qrDataUrl: string }> {
  const booking = await prisma.booking.findUnique({ where: { reference } });
  if (!booking) throw notFound('Booking not found');
  if (booking.userId !== userId) throw forbidden('This ticket does not belong to you');
  const qrDataUrl = await generateQrDataUrl(booking.qrToken);
  return { reference: booking.reference, qrDataUrl };
}

export async function verifyTicket(token: string): Promise<TicketVerifyDTO> {
  let reference: string;
  try {
    const payload = verifyTicketToken(token);
    if (payload.kind !== 'ticket' || !payload.ref) return { valid: false, reason: 'Invalid ticket token' };
    reference = payload.ref;
  } catch {
    return { valid: false, reason: 'Invalid or tampered ticket token' };
  }

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: {
      user: { select: { name: true } },
      show: { include: { event: { select: { title: true } }, venue: { select: { name: true } } } },
      seats: { include: { showSeat: { include: { venueSeat: true } } } },
    },
  });
  if (!booking) return { valid: false, reason: 'Ticket not found' };

  const base = {
    reference: booking.reference,
    status: booking.status,
    eventTitle: booking.show.event.title,
    venueName: booking.show.venue.name,
    startsAt: booking.show.startsAt.toISOString(),
    customerName: booking.user.name,
    seats: booking.seats.map((s) => `${s.showSeat.venueSeat.rowLabel}${s.showSeat.venueSeat.colNumber}`),
  };

  if (booking.status !== BookingStatus.CONFIRMED) {
    return { valid: false, reason: 'Booking was cancelled', ...base };
  }
  return { valid: true, ...base };
}
