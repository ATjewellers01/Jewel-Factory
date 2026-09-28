import { Hono } from 'hono';

import {
  getRetailerOrderActivity,
  summarizeRetailerActivity,
  listLoginActivity,
  listUserSessionStatus,
} from '@/lib/db/manufacturer-activity';
import { sendData } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';

export const manufacturerActivityRoutes = new Hono<AppEnv>();
manufacturerActivityRoutes.use('*', manufacturerGuard);

// GET /api/manufacturer/activity/orders — Task B: activated / monthly-ordering
// / inactive (no order in 30 days) retailer metrics, order data only.
manufacturerActivityRoutes.get('/activity/orders', async (c) => {
  const manufacturerId = c.get('manufacturerId');
  const rows = await getRetailerOrderActivity(manufacturerId);
  const summary = summarizeRetailerActivity(rows);
  return sendData(c, { summary, rows });
});

// GET /api/manufacturer/activity/logins — Task A: login/logout audit log,
// optional ?userType=RETAILER|BRANCH_MANAGER&storeId=&from=&to= filters.
manufacturerActivityRoutes.get('/activity/logins', async (c) => {
  const manufacturerId = c.get('manufacturerId');
  const userTypeParam = c.req.query('userType');
  const userType = userTypeParam === 'RETAILER' || userTypeParam === 'BRANCH_MANAGER' ? userTypeParam : undefined;
  const storeId = c.req.query('storeId') || undefined;
  const fromParam = c.req.query('from');
  const toParam = c.req.query('to');
  const from = fromParam ? new Date(fromParam) : undefined;
  const to = toParam ? new Date(toParam) : undefined;

  const rows = await listLoginActivity(manufacturerId, {
    userType,
    storeId,
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
  });
  return sendData(c, rows);
});

// GET /api/manufacturer/activity/sessions — current active/inactive status
// per retailer/store-manager, derived from the most recent login event.
manufacturerActivityRoutes.get('/activity/sessions', async (c) => {
  const manufacturerId = c.get('manufacturerId');
  const rows = await listUserSessionStatus(manufacturerId);
  return sendData(c, rows);
});
