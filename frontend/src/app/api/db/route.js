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
      users: body.users !== undefined ? body.users : current.users,
      stores: body.stores !== undefined ? body.stores : current.stores,
      menu_items: body.menu_items !== undefined ? body.menu_items : current.menu_items,
      active_orders: body.active_orders !== undefined ? body.active_orders : current.active_orders,
      completed_orders: body.completed_orders !== undefined ? body.completed_orders : current.completed_orders
    };

    saveDb(updated);
    // Strip passwords from returned users
    const safeUsers = updated.users.map(({ password, ...rest }) => rest);
    return NextResponse.json({ ...updated, users: safeUsers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
