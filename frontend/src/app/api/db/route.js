import { NextResponse } from 'next/server';
import { pool, getDb, initDbTables } from './db-helper';
import { verifyToken, hashPassword } from '../auth/token';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// GET /api/db - Admin-only: returns the full database (without passwords)
export async function GET(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const safeUsers = db.users.map(({ password, ...rest }) => rest);
    return NextResponse.json({ ...db, users: safeUsers });
  } catch (err) {
    console.error('Fetch DB error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/db - Admin-only: update specific tables in database
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // 1. Update stores
    if (body.stores !== undefined) {
      for (const s of body.stores) {
        await pool.query(
          `INSERT INTO stores (id, name, rent, status, address, manager, "staffCount", "dailyTarget", "historicalRevenue", "historicalOrders", city, pincode, lat, lng)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, rent = EXCLUDED.rent, status = EXCLUDED.status, address = EXCLUDED.address,
             manager = EXCLUDED.manager, "staffCount" = EXCLUDED."staffCount", "dailyTarget" = EXCLUDED."dailyTarget",
             "historicalRevenue" = EXCLUDED."historicalRevenue", "historicalOrders" = EXCLUDED."historicalOrders",
             city = EXCLUDED.city, pincode = EXCLUDED.pincode, lat = EXCLUDED.lat, lng = EXCLUDED.lng`,
          [s.id, s.name, s.rent || 0, s.status || 'Closed', s.address, s.manager, s.staffCount || 0, s.dailyTarget || 0, s.historicalRevenue || 0, s.historicalOrders || 0, s.city || null, s.pincode || null, s.lat !== undefined && s.lat !== null ? parseFloat(s.lat) : null, s.lng !== undefined && s.lng !== null ? parseFloat(s.lng) : null]
        );
      }
    }

    // 2. Update calendar_events (differential sync instead of full wipe)
    if (body.calendar_events !== undefined) {
      const eventIds = body.calendar_events.map(e => e.id).filter(Boolean);
      if (eventIds.length > 0) {
        const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`DELETE FROM calendar_events WHERE id NOT IN (${placeholders})`, eventIds);
      } else {
        await pool.query('DELETE FROM calendar_events');
      }

      for (const e of body.calendar_events) {
        await pool.query(
          `INSERT INTO calendar_events (id, title, start, "end", "storeId", type, color, description, "allDay", date, time)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title, start = EXCLUDED.start, "end" = EXCLUDED."end",
             "storeId" = EXCLUDED."storeId", type = EXCLUDED.type, color = EXCLUDED.color,
             description = EXCLUDED.description, "allDay" = EXCLUDED."allDay",
             date = EXCLUDED.date, time = EXCLUDED.time`,
          [e.id, e.title, e.start, e.end, e.storeId, e.type, e.color, e.description, e.allDay || false, e.date || null, e.time || null]
        );
      }
    }

    // 3. Update daily_reports
    if (body.daily_reports !== undefined) {
      const reportIds = body.daily_reports.map(r => r.id).filter(Boolean);
      if (reportIds.length > 0) {
        const placeholders = reportIds.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`DELETE FROM daily_reports WHERE id NOT IN (${placeholders})`, reportIds);
      } else {
        await pool.query('DELETE FROM daily_reports');
      }

      for (const r of body.daily_reports) {
        await pool.query(
          `INSERT INTO daily_reports (id, "storeId", "storeName", date, "totalSales", "totalExpenses", "totalWaste", "activeShiftsCount", "stockAlertsCount", "submittedAt", "submittedBy", status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             "storeId" = EXCLUDED."storeId", "storeName" = EXCLUDED."storeName", date = EXCLUDED.date,
             "totalSales" = EXCLUDED."totalSales", "totalExpenses" = EXCLUDED."totalExpenses",
             "totalWaste" = EXCLUDED."totalWaste", "activeShiftsCount" = EXCLUDED."activeShiftsCount",
             "stockAlertsCount" = EXCLUDED."stockAlertsCount", "submittedAt" = EXCLUDED."submittedAt",
             "submittedBy" = EXCLUDED."submittedBy", status = EXCLUDED.status`,
          [r.id, r.storeId, r.storeName, r.date, r.totalSales, r.totalExpenses, r.totalWaste, r.activeShiftsCount, r.stockAlertsCount, r.submittedAt, r.submittedBy, r.status]
        );
      }
    }

    // 4. Update stock_items
    if (body.stock_items !== undefined) {
      for (const s of body.stock_items) {
        await pool.query(
          `INSERT INTO stock_items (id, unit, "minQty", "storeId", "itemName", "currentQty")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             unit = EXCLUDED.unit, "minQty" = EXCLUDED."minQty", "storeId" = EXCLUDED."storeId",
             "itemName" = EXCLUDED."itemName", "currentQty" = EXCLUDED."currentQty"`,
          [s.id, s.unit, s.minQty || 0, s.storeId, s.itemName, s.currentQty || 0]
        );
      }
    }

    // 5. Update stock_orders
    if (body.stock_orders !== undefined) {
      const orderIds = body.stock_orders.map(o => o.id).filter(Boolean);
      if (orderIds.length > 0) {
        const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`DELETE FROM stock_orders WHERE id NOT IN (${placeholders})`, orderIds);
      } else {
        await pool.query('DELETE FROM stock_orders');
      }

      for (const o of body.stock_orders) {
        await pool.query(
          `INSERT INTO stock_orders (id, items, status, "storeId", "storeName", timestamp, "requestedBy")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             items = EXCLUDED.items, status = EXCLUDED.status, "storeId" = EXCLUDED."storeId",
             "storeName" = EXCLUDED."storeName", timestamp = EXCLUDED.timestamp, "requestedBy" = EXCLUDED."requestedBy"`,
          [o.id, JSON.stringify(o.items), o.status || 'Pending', o.storeId, o.storeName, o.timestamp, o.requestedBy]
        );
      }
    }

    // 6. Update users (with secure password handling)
    if (body.users !== undefined) {
      for (const u of body.users) {
        const existingRes = await pool.query('SELECT password FROM users WHERE id = $1', [u.id]);
        let passwordToSet = '';
        if (existingRes.rows.length > 0) {
          passwordToSet = u.password ? (u.password.includes(':') ? u.password : hashPassword(u.password)) : existingRes.rows[0].password;
        } else {
          passwordToSet = u.password ? (u.password.includes(':') ? u.password : hashPassword(u.password)) : hashPassword(crypto.randomUUID());
        }

        await pool.query(
          `INSERT INTO users (id, name, email, password, role, "storeId")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role, "storeId" = EXCLUDED."storeId"`,
          [u.id, u.name, u.email, passwordToSet, u.role, u.storeId]
        );
      }
    }

    // 7. Update menu_items
    if (body.menu_items !== undefined) {
      const menuItemIds = body.menu_items.map(m => m.id).filter(Boolean);
      if (menuItemIds.length > 0) {
        const placeholders = menuItemIds.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`DELETE FROM menu_items WHERE id NOT IN (${placeholders})`, menuItemIds);
      } else {
        await pool.query('DELETE FROM menu_items');
      }

      for (const m of body.menu_items) {
        await pool.query(
          `INSERT INTO menu_items (id, name, type, image, price, calories, category, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, type = EXCLUDED.type, image = EXCLUDED.image, price = EXCLUDED.price,
             calories = EXCLUDED.calories, category = EXCLUDED.category, description = EXCLUDED.description`,
          [m.id, m.name, m.type, m.image, m.price || 0, m.calories || 0, m.category, m.description]
        );
      }
    }

    // 8. Update messages
    if (body.messages !== undefined) {
      const messageIds = body.messages.map(m => m.id).filter(Boolean);
      if (messageIds.length > 0) {
        const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`DELETE FROM messages WHERE id NOT IN (${placeholders})`, messageIds);
      } else {
        await pool.query('DELETE FROM messages');
      }

      for (const m of body.messages) {
        await pool.query(
          `INSERT INTO messages (id, text, sender, "storeId", "storeName", timestamp, "senderRole")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             text = EXCLUDED.text, sender = EXCLUDED.sender, "storeId" = EXCLUDED."storeId",
             "storeName" = EXCLUDED."storeName", timestamp = EXCLUDED.timestamp, "senderRole" = EXCLUDED."senderRole"`,
          [m.id, m.text, m.sender, m.storeId, m.storeName, m.timestamp, m.senderRole]
        );
      }
    }

    const updatedDb = await getDb();
    const safeUsers = updatedDb.users.map(({ password, ...rest }) => rest);
    return NextResponse.json({ ...updatedDb, users: safeUsers });
  } catch (err) {
    console.error('Update DB error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
