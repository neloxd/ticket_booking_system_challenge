import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import type { Role } from '@ticket/shared';

let counter = 0;
const uniq = () => `${Date.now().toString(36)}-${(counter += 1)}`;

export async function createUser(role: Role = 'CUSTOMER') {
  const passwordHash = await bcrypt.hash('password123', 4);
  return prisma.user.create({
    data: { email: `u-${uniq()}@test.dev`, passwordHash, name: `User ${uniq()}`, role },
  });
}

export interface ShowFixture {
  organiserId: string;
  venueId: string;
  categoryId: string;
  eventId: string;
  show: { id: string };
  showSeatIds: string[];
}

export async function createShowFixture(opts: { seats?: number; price?: number } = {}): Promise<ShowFixture> {
  const seats = opts.seats ?? 5;
  const price = opts.price ?? 100;

  const organiser = await createUser('ORGANISER');
  const venue = await prisma.venue.create({ data: { name: `Venue ${uniq()}`, address: 'Test St' } });
  const category = await prisma.seatCategory.create({
    data: { venueId: venue.id, name: 'Premium', color: '#f59e0b' },
  });

  const venueSeatData: Prisma.VenueSeatCreateManyInput[] = [];
  for (let i = 1; i <= seats; i += 1) {
    venueSeatData.push({
      venueId: venue.id,
      categoryId: category.id,
      rowLabel: 'A',
      colNumber: i,
      gridRow: 1,
      gridCol: i,
    });
  }
  await prisma.venueSeat.createMany({ data: venueSeatData });
  const venueSeats = await prisma.venueSeat.findMany({
    where: { venueId: venue.id },
    orderBy: { colNumber: 'asc' },
  });

  const event = await prisma.event.create({
    data: { organiserId: organiser.id, title: `Event ${uniq()}`, type: 'MOVIE' },
  });
  const show = await prisma.show.create({
    data: { eventId: event.id, venueId: venue.id, startsAt: new Date(Date.now() + 86_400_000) },
  });
  await prisma.showPricing.create({
    data: { showId: show.id, seatCategoryId: category.id, price },
  });
  await prisma.showSeat.createMany({
    data: venueSeats.map((vs) => ({
      showId: show.id,
      venueSeatId: vs.id,
      seatCategoryId: category.id,
      status: 'AVAILABLE' as const,
    })),
  });
  const showSeats = await prisma.showSeat.findMany({
    where: { showId: show.id },
    orderBy: { venueSeat: { colNumber: 'asc' } },
  });

  return {
    organiserId: organiser.id,
    venueId: venue.id,
    categoryId: category.id,
    eventId: event.id,
    show: { id: show.id },
    showSeatIds: showSeats.map((s) => s.id),
  };
}
