import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';
import { rateLimit, getClientIp } from '../../auth/rate-limiter';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

const defaultStockItems = [
  { name: "Whole Chicken Pieces", minQty: 50, unit: "kgs" },
  { name: "Chicken Breast Fillets", minQty: 100, unit: "units" },
  { name: "Burger Buns", minQty: 80, unit: "packs of 6" },
  { name: "Crinkle Fries (Frozen)", minQty: 30, unit: "bags of 2.5kg" },
  { name: "Frying Vegetable Oil", minQty: 40, unit: "liters" },
  { name: "Pepsi Syrup Bag-in-Box", minQty: 5, unit: "units (20L)" },
  { name: "Lettuce Leaves", minQty: 15, unit: "kgs" },
  { name: "Spicy Burger Mayonnaise", minQty: 6, unit: "tubs of 5kg" },
  { name: "Branded Wrapping Paper", minQty: 2, unit: "boxes" }
];

const defaultStaff = [
  { name: "Alice Vance", role: "Cashier", hourlyRate: 15, phone: "+1 (555) 123-4567" },
  { name: "Bob Cook", role: "Head Fryer", hourlyRate: 18, phone: "+1 (555) 234-5678" },
  { name: "Charlie Rider", role: "Delivery Driver", hourlyRate: 12, phone: "+1 (555) 345-6789" },
  { name: "Diana Supervisor", role: "Shift Lead", hourlyRate: 20, phone: "+1 (555) 456-7890" }
];

async function ensureDbIntegrity(storeId) {
  if (!storeId) return;

  // Check stock items
  const stockCount = await pool.query('SELECT COUNT(*) FROM stock_items WHERE "storeId" = $1', [storeId]);
  if (parseInt(stockCount.rows[0].count, 10) === 0) {
    for (let idx = 0; idx < defaultStockItems.length; idx++) {
      const item = defaultStockItems[idx];
      const id = `stock-${storeId}-${idx}-${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO stock_items (id, unit, "minQty", "storeId", "itemName", "currentQty")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, item.unit, item.minQty, storeId, item.name, item.minQty * 2]
      );
    }
  }

  // Check staff rota
  const staffCount = await pool.query('SELECT COUNT(*) FROM staff_rota WHERE "storeId" = $1', [storeId]);
  if (parseInt(staffCount.rows[0].count, 10) === 0) {
    const defaultSchedule = {
      Mon: "09:00 - 17:00",
      Tue: "09:00 - 17:00",
      Wed: "09:00 - 17:00",
      Thu: "09:00 - 17:00",
      Fri: "09:00 - 17:00",
      Sat: "OFF",
      Sun: "OFF"
    };
    for (let idx = 0; idx < defaultStaff.length; idx++) {
      const staff = defaultStaff[idx];
      const id = `staff-${storeId}-${idx}-${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO staff_rota (id, name, role, phone, "storeId", schedule, "hourlyRate")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, staff.name, staff.role, staff.phone, storeId, JSON.stringify(defaultSchedule), staff.hourlyRate]
      );
    }
  }
}

async function getStoreOpsData(storeId) {
  const expenses = await pool.query('SELECT * FROM expenses WHERE "storeId" = $1', [storeId]);
  const shifts = await pool.query('SELECT * FROM shifts WHERE "storeId" = $1', [storeId]);
  const waste_log = await pool.query('SELECT * FROM waste_log WHERE "storeId" = $1', [storeId]);
  const stock_items = await pool.query('SELECT * FROM stock_items WHERE "storeId" = $1 ORDER BY "itemName" ASC', [storeId]);
  const staff_rota = await pool.query('SELECT * FROM staff_rota WHERE "storeId" = $1 ORDER BY name ASC', [storeId]);
  const stock_orders = await pool.query('SELECT * FROM stock_orders WHERE "storeId" = $1 ORDER BY timestamp DESC', [storeId]);
  const daily_reports = await pool.query('SELECT * FROM daily_reports WHERE "storeId" = $1 ORDER BY date DESC', [storeId]);

  return {
    expenses: expenses.rows.map(e => ({ ...e, amount: parseFloat(e.amount || 0) })),
    shifts: shifts.rows,
    waste_log: waste_log.rows.map(w => ({ ...w, quantity: parseFloat(w.quantity || 0), cost: parseFloat(w.cost || 0) })),
    stock_items: stock_items.rows.map(s => ({ ...s, minQty: parseFloat(s.minQty || 0), currentQty: parseFloat(s.currentQty || 0) })),
    staff_rota: staff_rota.rows.map(r => ({ ...r, hourlyRate: parseFloat(r.hourlyRate || 0) })),
    stock_orders: stock_orders.rows,
    daily_reports: daily_reports.rows.map(r => ({
      ...r,
      totalSales: parseFloat(r.totalSales || 0),
      totalExpenses: parseFloat(r.totalExpenses || 0),
      totalWaste: parseFloat(r.totalWaste || 0)
    }))
  };
}

// GET /api/store/ops?storeId=<storeId>
export async function GET(request) {
  await initDbTables();
  const user = getAuthUser(request);
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: 'Store ID is required.' }, { status: 400 });
  }

  // Authorize: Admin or Store Manager matching storeId
  if (!user || (user.role !== 'SUPER_ADMIN' && (user.role !== 'BRANCH_MANAGER' || user.storeId !== storeId))) {
    return NextResponse.json({ error: 'Unauthorized. Store operator or admin access required.' }, { status: 401 });
  }

  try {
    await ensureDbIntegrity(storeId);
    const data = await getStoreOpsData(storeId);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Fetch store ops error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/store/ops
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitRes = rateLimit(ip, 20); // 20 requests per minute limit
  if (!limitRes.success) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 });
  }

  try {
    const { action, storeId, data } = await request.json();

    if (!storeId || !action) {
      return NextResponse.json({ error: 'storeId and action are required.' }, { status: 400 });
    }

    // Authorize: Admin or Store Manager matching storeId
    if (user.role !== 'SUPER_ADMIN' && (user.role !== 'BRANCH_MANAGER' || user.storeId !== storeId)) {
      return NextResponse.json({ error: 'Unauthorized. Store operator access required.' }, { status: 401 });
    }

    await ensureDbIntegrity(storeId);

    const timestamp = new Date().toISOString();
    const id = `op-${crypto.randomUUID()}`;

    switch (action) {
      case 'log_expense': {
        const { amount, category, description } = data;
        if (!amount || !category) {
          return NextResponse.json({ error: 'Amount and category are required.' }, { status: 400 });
        }
        await pool.query(
          `INSERT INTO expenses (id, "storeId", amount, category, description, timestamp, "recordedBy")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, storeId, parseFloat(amount), category, description || '', timestamp, user.name]
        );
        console.log(`[AUDIT] Expense logged: ${id} (amount: ${amount}) for store ${storeId} by user ${user.email}`);
        break;
      }

      case 'clock_in': {
        const { staffName } = data;
        if (!staffName) {
          return NextResponse.json({ error: 'Staff name is required.' }, { status: 400 });
        }
        // Check if already clocked in today (where clockOut is NULL)
        const checkRes = await pool.query(
          'SELECT id FROM shifts WHERE "storeId" = $1 AND "staffName" = $2 AND "clockOut" IS NULL',
          [storeId, staffName]
        );
        if (checkRes.rows.length > 0) {
          return NextResponse.json({ error: `${staffName} is already clocked in.` }, { status: 400 });
        }
        await pool.query(
          `INSERT INTO shifts (id, "storeId", "staffName", "clockIn", "clockOut", date)
           VALUES ($1, $2, $3, $4, NULL, $5)`,
          [id, storeId, staffName, timestamp, timestamp.split('T')[0]]
        );
        console.log(`[AUDIT] Shift clocked in: ${id} for ${staffName} at store ${storeId}`);
        break;
      }

      case 'clock_out': {
        const { shiftId } = data;
        if (!shiftId) {
          return NextResponse.json({ error: 'Shift ID is required.' }, { status: 400 });
        }
        const checkRes = await pool.query('SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2', [shiftId, storeId]);
        if (checkRes.rows.length === 0) {
          return NextResponse.json({ error: 'Active shift not found.' }, { status: 404 });
        }
        await pool.query(
          'UPDATE shifts SET "clockOut" = $1 WHERE id = $2',
          [timestamp, shiftId]
        );
        console.log(`[AUDIT] Shift clocked out: ${shiftId} at store ${storeId}`);
        break;
      }

      case 'log_waste': {
        const { itemName, quantity, reason, cost } = data;
        if (!itemName || !quantity || !cost) {
          return NextResponse.json({ error: 'Item, quantity, and cost are required.' }, { status: 400 });
        }
        await pool.query(
          `INSERT INTO waste_log (id, "storeId", "itemName", quantity, reason, cost, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, storeId, itemName, parseFloat(quantity), reason || 'Other', parseFloat(cost), timestamp]
        );
        console.log(`[AUDIT] Waste logged: ${id} for ${itemName} (cost: ${cost}) for store ${storeId} by user ${user.email}`);
        break;
      }

      case 'update_stock': {
        const { stockId, currentQty } = data;
        if (!stockId || currentQty === undefined) {
          return NextResponse.json({ error: 'Stock ID and quantity are required.' }, { status: 400 });
        }
        const checkRes = await pool.query('SELECT id FROM stock_items WHERE id = $1 AND "storeId" = $2', [stockId, storeId]);
        if (checkRes.rows.length === 0) {
          return NextResponse.json({ error: 'Stock item not found.' }, { status: 404 });
        }
        await pool.query(
          'UPDATE stock_items SET "currentQty" = $1 WHERE id = $2',
          [parseFloat(currentQty), stockId]
        );
        console.log(`[AUDIT] Stock updated: ${stockId} to quantity ${currentQty} at store ${storeId} by user ${user.email}`);
        break;
      }

      case 'send_stock_order': {
        const { items } = data; // Array of { itemName, quantity, unit }
        if (!items || items.length === 0) {
          return NextResponse.json({ error: 'Items list is required.' }, { status: 400 });
        }
        
        let storeName = 'Unknown';
        const storeNameRes = await pool.query('SELECT name FROM stores WHERE id = $1', [storeId]);
        if (storeNameRes.rows.length > 0) storeName = storeNameRes.rows[0].name;

        const soId = `so-${crypto.randomUUID()}`;
        await pool.query(
          `INSERT INTO stock_orders (id, "storeId", "storeName", items, timestamp, status, "requestedBy")
           VALUES ($1, $2, $3, $4, $5, 'Pending', $6)`,
          [soId, storeId, storeName, JSON.stringify(items), timestamp, user.name]
        );
        console.log(`[AUDIT] Stock order placed: ${soId} for store ${storeId} by user ${user.email}`);
        break;
      }

      case 'send_report': {
        const { totalSales, totalExpenses, totalWaste, activeShiftsCount, stockAlertsCount } = data;
        let storeName = 'Unknown';
        const storeNameRes = await pool.query('SELECT name FROM stores WHERE id = $1', [storeId]);
        if (storeNameRes.rows.length > 0) storeName = storeNameRes.rows[0].name;

        const repId = `rep-${crypto.randomUUID()}`;
        await pool.query(
          `INSERT INTO daily_reports (id, "storeId", "storeName", date, "totalSales", "totalExpenses", "totalWaste", "activeShiftsCount", "stockAlertsCount", "submittedAt", "submittedBy", status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Pending')`,
          [
            repId,
            storeId,
            storeName,
            timestamp.split('T')[0],
            parseFloat(totalSales || 0),
            parseFloat(totalExpenses || 0),
            parseFloat(totalWaste || 0),
            parseInt(activeShiftsCount || 0),
            parseInt(stockAlertsCount || 0),
            timestamp,
            user.name
          ]
        );
        console.log(`[AUDIT] Daily report submitted: ${repId} for store ${storeId} by user ${user.email}`);
        break;
      }

      case 'update_staff_rota': {
        const { staffId, name, role, hourlyRate, phone, schedule } = data;
        if (!name || !role) {
          return NextResponse.json({ error: 'Name and role are required.' }, { status: 400 });
        }

        if (staffId) {
          const checkRes = await pool.query('SELECT id FROM staff_rota WHERE id = $1 AND "storeId" = $2', [staffId, storeId]);
          if (checkRes.rows.length === 0) {
            return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
          }
          await pool.query(
            `UPDATE staff_rota 
             SET name = $1, role = $2, "hourlyRate" = $3, phone = $4, schedule = COALESCE($5, schedule)
             WHERE id = $6`,
            [name.trim(), role.trim(), parseFloat(hourlyRate || 0), phone || '', schedule ? JSON.stringify(schedule) : null, staffId]
          );
          console.log(`[AUDIT] Staff rota updated: ${staffId} at store ${storeId} by user ${user.email}`);
        } else {
          const newStaffId = `staff-${storeId}-${crypto.randomUUID()}`;
          const defaultSched = {
            Mon: "OFF", Tue: "OFF", Wed: "OFF", Thu: "OFF", Fri: "OFF", Sat: "OFF", Sun: "OFF"
          };
          await pool.query(
            `INSERT INTO staff_rota (id, "storeId", name, role, "hourlyRate", phone, schedule)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newStaffId, storeId, name.trim(), role.trim(), parseFloat(hourlyRate || 0), phone || '', JSON.stringify(schedule || defaultSched)]
          );
          console.log(`[AUDIT] Staff rota created: ${newStaffId} for store ${storeId} by user ${user.email}`);
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    const outputData = await getStoreOpsData(storeId);
    return NextResponse.json({
      success: true,
      ...outputData
    });

  } catch (err) {
    console.error('Store ops POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
