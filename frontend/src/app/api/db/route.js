import { NextResponse } from 'next/server';
import { getDb, saveDb } from './db-helper';
import { verifyToken } from '../auth/token';

// Helper to extract and verify the JWT token from the request
function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return verifyToken(authHeader.substring(7));
}

// GET /api/db - Admin-only: returns the full database (without passwords)
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  const db = getDb();

  // Strip passwords from users before returning
  const safeUsers = db.users.map(({ password, ...rest }) => rest);
  return NextResponse.json({ ...db, users: safeUsers });
}

// POST /api/db - Admin-only: update the full database
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const current = getDb();

    // Merge updates
    const updated = {
      ...current,
      users: body.users !== undefined ? body.users : current.users,
      stores: body.stores !== undefined ? body.stores : current.stores,
      menu_items: body.menu_items !== undefined ? body.menu_items : current.menu_items,
      active_orders: body.active_orders !== undefined ? body.active_orders : current.active_orders,
      completed_orders: body.completed_orders !== undefined ? body.completed_orders : current.completed_orders,
      expenses: body.expenses !== undefined ? body.expenses : current.expenses,
      shifts: body.shifts !== undefined ? body.shifts : current.shifts,
      waste_log: body.waste_log !== undefined ? body.waste_log : current.waste_log,
      stock_items: body.stock_items !== undefined ? body.stock_items : current.stock_items,
      staff_rota: body.staff_rota !== undefined ? body.staff_rota : current.staff_rota,
      stock_orders: body.stock_orders !== undefined ? body.stock_orders : current.stock_orders,
      daily_reports: body.daily_reports !== undefined ? body.daily_reports : current.daily_reports
    };

    saveDb(updated);
    // Strip passwords from returned users
    const safeUsers = updated.users.map(({ password, ...rest }) => rest);
    return NextResponse.json({ ...updated, users: safeUsers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
