import { env } from '../config/env';
import { logger } from '../lib/logger';
import { releaseExpiredHolds } from '../modules/holds/holds.service';
import { processExpiredOffers } from '../modules/waitlist/waitlist.service';


let timer: NodeJS.Timeout | null = null;
let running = false;

async function sweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const [holds, offers] = await Promise.all([releaseExpiredHolds(), processExpiredOffers()]);
    if (holds > 0 || offers > 0) {
      logger.info(`Sweeper: released ${holds} expired hold(s), processed ${offers} expired offer(s)`);
    }
  } catch (err) {
    logger.error('Sweeper run failed:', err);
  } finally {
    running = false;
  }
}

export function startSweeper(): () => void {
  timer = setInterval(() => void sweep(), env.SWEEP_INTERVAL_SECONDS * 1000);
  timer.unref?.();
  logger.info(`Sweeper started (every ${env.SWEEP_INTERVAL_SECONDS}s)`);
  setTimeout(() => void sweep(), 1000).unref?.();
  return stopSweeper;
}

export function stopSweeper(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
