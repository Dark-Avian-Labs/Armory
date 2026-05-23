import { verifyWebhook, type WebhookEvent } from '@clerk/express/webhooks';
import { Router, type Request, type Response } from 'express';

import { markArmoryUserDeleted, upsertArmoryUser } from '../auth/armoryUsers.js';
import { CLERK_WEBHOOK_SIGNING_SECRET } from '../config.js';
import { log } from '../logger.js';

export const clerkWebhookRouter = Router();

type ClerkUserWebhookData = {
  id?: string;
  username?: string | null;
};

function readUserPayload(event: WebhookEvent): ClerkUserWebhookData | null {
  const data = event.data as ClerkUserWebhookData;
  if (!data || typeof data.id !== 'string' || data.id.trim().length === 0) {
    return null;
  }
  return data;
}

clerkWebhookRouter.post('/', async (req: Request, res: Response) => {
  if (!CLERK_WEBHOOK_SIGNING_SECRET) {
    res.status(500).json({ error: 'Webhook signing secret not configured' });
    return;
  }

  let event: WebhookEvent;
  try {
    event = await verifyWebhook(req, {
      signingSecret: CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (err) {
    log('warn', 'Clerk webhook verification failed', {
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(400).json({ error: 'Webhook verification failed' });
    return;
  }

  try {
    switch (event.type) {
      case 'user.created': {
        const data = readUserPayload(event);
        if (!data?.id) break;
        const username = typeof data.username === 'string' ? data.username.trim() : '';
        if (username.length > 0) {
          upsertArmoryUser(data.id, username);
        }
        break;
      }
      case 'user.updated': {
        const data = readUserPayload(event);
        if (!data?.id) break;
        const username = typeof data.username === 'string' ? data.username.trim() : '';
        upsertArmoryUser(data.id, username.length > 0 ? username : null);
        break;
      }
      case 'user.deleted': {
        const data = readUserPayload(event);
        if (data?.id) {
          markArmoryUserDeleted(data.id);
        }
        break;
      }
      default:
        break;
    }

    res.json({ ok: true });
  } catch (err) {
    log('error', 'Clerk webhook processing failed', {
      eventType: event.type,
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
