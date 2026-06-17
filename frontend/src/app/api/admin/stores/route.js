import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// POST /api/admin/stores - Create a new store (admin only)
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { name, address, manager, rent, staffCount, dailyTarget } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Store name is required.' }, { status: 400 });
    }

    const db = getDb();
    const newStore = {
      id: `st${Date.now()}`,
      name: name.trim(),
      address: (address || '').trim(),
      manager: (manager || 'Unassigned').trim(),
      status: 'Open',
      rent: parseInt(rent) || 0,
      staffCount: parseInt(staffCount) || 0,
      dailyTarget: parseInt(dailyTarget) || 0,
      historicalRevenue: 0,
      historicalOrders: 0
    };

    const updatedStores = [...db.stores, newStore];
    saveDb({ ...db, stores: updatedStores });

    return NextResponse.json({ success: true, stores: updatedStores });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/stores - Delete a store (admin only)
export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { storeId } = await request.json();
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required.' }, { status: 400 });
    }

    const db = getDb();
    const updatedStores = db.stores.filter(s => s.id !== storeId);
    
    // Also remove store managers linked to this store
    const updatedUsers = db.users.filter(u => u.storeId !== storeId);

    saveDb({ ...db, stores: updatedStores, users: updatedUsers });

    const safeUsers = updatedUsers.map(({ password, ...rest }) => rest);
    return NextResponse.json({ success: true, stores: updatedStores, users: safeUsers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
