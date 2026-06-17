import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// Default initializations
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

function ensureDbIntegrity(db, storeId) {
  let changed = false;
  if (!db.expenses) { db.expenses = []; changed = true; }
  if (!db.shifts) { db.shifts = []; changed = true; }
  if (!db.waste_log) { db.waste_log = []; changed = true; }
  if (!db.daily_reports) { db.daily_reports = []; changed = true; }
  if (!db.staff_rota) { db.staff_rota = []; changed = true; }
  if (!db.stock_orders) { db.stock_orders = []; changed = true; }
  if (!db.stock_items) { db.stock_items = []; changed = true; }

  // Check if stock_items exists for this storeId
  const hasStock = db.stock_items.some(item => item.storeId === storeId);
  if (!hasStock && storeId) {
    defaultStockItems.forEach((item, idx) => {
      db.stock_items.push({
        id: `stock-${storeId}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`,
        storeId,
        itemName: item.name,
        currentQty: item.minQty * 2,
        minQty: item.minQty,
        unit: item.unit
      });
    });
    changed = true;
  }

  // Check if staff_rota exists for this storeId
  const hasStaff = db.staff_rota.some(staff => staff.storeId === storeId);
  if (!hasStaff && storeId) {
    defaultStaff.forEach((staff, idx) => {
      db.staff_rota.push({
        id: `staff-${storeId}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`,
        storeId,
        name: staff.name,
        role: staff.role,
        hourlyRate: staff.hourlyRate,
        phone: staff.phone,
        schedule: {
          Mon: "09:00 - 17:00",
          Tue: "09:00 - 17:00",
          Wed: "09:00 - 17:00",
          Thu: "09:00 - 17:00",
          Fri: "09:00 - 17:00",
          Sat: "OFF",
          Sun: "OFF"
        }
      });
    });
    changed = true;
  }

  if (changed) {
    saveDb(db);
  }
}

// GET /api/store/ops?storeId=<storeId>
export async function GET(request) {
  const user = getAuthUser(request);
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: 'Store ID is required.' }, { status: 400 });
  }

  // Authorize: Admin or Store Manager matching storeId
  if (!user || (user.role !== 'admin' && (user.role !== 'store_manager' || user.storeId !== storeId))) {
    return NextResponse.json({ error: 'Unauthorized. Store operator or admin access required.' }, { status: 401 });
  }

  const db = getDb();
  ensureDbIntegrity(db, storeId);

  return NextResponse.json({
    expenses: db.expenses.filter(e => e.storeId === storeId),
    shifts: db.shifts.filter(s => s.storeId === storeId),
    waste_log: db.waste_log.filter(w => w.storeId === storeId),
    stock_items: db.stock_items.filter(s => s.storeId === storeId),
    staff_rota: db.staff_rota.filter(s => s.storeId === storeId),
    stock_orders: db.stock_orders.filter(o => o.storeId === storeId),
    daily_reports: db.daily_reports.filter(r => r.storeId === storeId)
  });
}

// POST /api/store/ops
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { action, storeId, data } = await request.json();

    if (!storeId || !action) {
      return NextResponse.json({ error: 'storeId and action are required.' }, { status: 400 });
    }

    // Authorize: Admin or Store Manager matching storeId
    if (user.role !== 'admin' && (user.role !== 'store_manager' || user.storeId !== storeId)) {
      return NextResponse.json({ error: 'Unauthorized. Store operator access required.' }, { status: 401 });
    }

    const db = getDb();
    ensureDbIntegrity(db, storeId);

    const timestamp = new Date().toISOString();
    const id = `op-${Math.floor(100000 + Math.random() * 900000)}`;

    switch (action) {
      case 'log_expense': {
        const { amount, category, description } = data;
        if (!amount || !category) {
          return NextResponse.json({ error: 'Amount and category are required.' }, { status: 400 });
        }
        db.expenses.push({
          id,
          storeId,
          amount: parseFloat(amount),
          category,
          description: description || '',
          timestamp,
          recordedBy: user.name
        });
        break;
      }

      case 'clock_in': {
        const { staffName } = data;
        if (!staffName) {
          return NextResponse.json({ error: 'Staff name is required.' }, { status: 400 });
        }
        // Check if already clocked in today
        const activeShift = db.shifts.find(s => s.storeId === storeId && s.staffName === staffName && !s.clockOut);
        if (activeShift) {
          return NextResponse.json({ error: `${staffName} is already clocked in.` }, { status: 400 });
        }
        db.shifts.push({
          id,
          storeId,
          staffName,
          clockIn: timestamp,
          clockOut: null,
          date: timestamp.split('T')[0]
        });
        break;
      }

      case 'clock_out': {
        const { shiftId } = data;
        if (!shiftId) {
          return NextResponse.json({ error: 'Shift ID is required.' }, { status: 400 });
        }
        const shiftIndex = db.shifts.findIndex(s => s.id === shiftId && s.storeId === storeId);
        if (shiftIndex === -1) {
          return NextResponse.json({ error: 'Active shift not found.' }, { status: 404 });
        }
        db.shifts[shiftIndex].clockOut = timestamp;
        break;
      }

      case 'log_waste': {
        const { itemName, quantity, reason, cost } = data;
        if (!itemName || !quantity || !cost) {
          return NextResponse.json({ error: 'Item, quantity, and cost are required.' }, { status: 400 });
        }
        db.waste_log.push({
          id,
          storeId,
          itemName,
          quantity: parseInt(quantity),
          reason: reason || 'Other',
          cost: parseFloat(cost),
          timestamp
        });
        break;
      }

      case 'update_stock': {
        const { stockId, currentQty } = data;
        if (!stockId || currentQty === undefined) {
          return NextResponse.json({ error: 'Stock ID and quantity are required.' }, { status: 400 });
        }
        const stockIndex = db.stock_items.findIndex(s => s.id === stockId && s.storeId === storeId);
        if (stockIndex === -1) {
          return NextResponse.json({ error: 'Stock item not found.' }, { status: 404 });
        }
        db.stock_items[stockIndex].currentQty = parseFloat(currentQty);
        break;
      }

      case 'send_stock_order': {
        const { items } = data; // Array of { itemName, quantity, unit }
        if (!items || items.length === 0) {
          return NextResponse.json({ error: 'Items list is required.' }, { status: 400 });
        }
        db.stock_orders.push({
          id: `so-${Math.floor(1000 + Math.random() * 9000)}`,
          storeId,
          storeName: db.stores.find(s => s.id === storeId)?.name || 'Unknown',
          items,
          timestamp,
          status: 'Pending',
          requestedBy: user.name
        });
        break;
      }

      case 'send_report': {
        const { totalSales, totalExpenses, totalWaste, activeShiftsCount, stockAlertsCount } = data;
        db.daily_reports.push({
          id: `rep-${Math.floor(1000 + Math.random() * 9000)}`,
          storeId,
          storeName: db.stores.find(s => s.id === storeId)?.name || 'Unknown',
          date: timestamp.split('T')[0],
          totalSales: parseFloat(totalSales || 0),
          totalExpenses: parseFloat(totalExpenses || 0),
          totalWaste: parseFloat(totalWaste || 0),
          activeShiftsCount: parseInt(activeShiftsCount || 0),
          stockAlertsCount: parseInt(stockAlertsCount || 0),
          submittedAt: timestamp,
          submittedBy: user.name,
          status: 'Pending'
        });
        break;
      }

      case 'update_staff_rota': {
        const { staffId, name, role, hourlyRate, phone, schedule } = data;
        if (!name || !role) {
          return NextResponse.json({ error: 'Name and role are required.' }, { status: 400 });
        }

        if (staffId) {
          // Edit existing staff member
          const staffIndex = db.staff_rota.findIndex(s => s.id === staffId && s.storeId === storeId);
          if (staffIndex === -1) {
            return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
          }
          db.staff_rota[staffIndex] = {
            ...db.staff_rota[staffIndex],
            name: name.trim(),
            role: role.trim(),
            hourlyRate: parseFloat(hourlyRate || 0),
            phone: phone || '',
            schedule: schedule || db.staff_rota[staffIndex].schedule
          };
        } else {
          // Add new staff member
          db.staff_rota.push({
            id: `staff-${storeId}-${Math.floor(1000 + Math.random() * 9000)}`,
            storeId,
            name: name.trim(),
            role: role.trim(),
            hourlyRate: parseFloat(hourlyRate || 0),
            phone: phone || '',
            schedule: schedule || {
              Mon: "OFF", Tue: "OFF", Wed: "OFF", Thu: "OFF", Fri: "OFF", Sat: "OFF", Sun: "OFF"
            }
          });
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    saveDb(db);

    // Return filtered lists for this store after update
    return NextResponse.json({
      success: true,
      expenses: db.expenses.filter(e => e.storeId === storeId),
      shifts: db.shifts.filter(s => s.storeId === storeId),
      waste_log: db.waste_log.filter(w => w.storeId === storeId),
      stock_items: db.stock_items.filter(s => s.storeId === storeId),
      staff_rota: db.staff_rota.filter(s => s.storeId === storeId),
      stock_orders: db.stock_orders.filter(o => o.storeId === storeId),
      daily_reports: db.daily_reports.filter(r => r.storeId === storeId)
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
