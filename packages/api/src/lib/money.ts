import type { Prisma } from '@prisma/client';

export const toMoney = (value: Prisma.Decimal | number | string): number => Number(value);

export const formatMoney = (value: Prisma.Decimal | number | string): string =>
  Number(value).toFixed(2);
