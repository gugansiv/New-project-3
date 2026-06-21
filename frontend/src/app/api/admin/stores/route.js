import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

async function getStores() {
  const res = await pool.query("SELECT * FROM stores WHERE status != 'Archived' ORDER BY name ASC");
  return res.rows.map(s => ({
    ...s,
    rent: parseFloat(s.rent || 0),
    dailyTarget: parseFloat(s.dailyTarget || 0),
    historicalRevenue: parseFloat(s.historicalRevenue || 0)
  }));
}

async function getSafeUsers() {
  const res = await pool.query('SELECT id, name, email, role, "storeId" FROM users ORDER BY name ASC');
  return res.rows;
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

// POST /api/admin/stores - Create a new store (admin only)
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { name, address, manager, rent, staffCount, dailyTarget } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Store name is required.' }, { status: 400 });
    }

    const id = `st${Date.now()}`;
    await pool.query(
      `INSERT INTO stores (id, name, rent, status, address, manager, "staffCount", "dailyTarget", "historicalRevenue", "historicalOrders")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0)`,
      [id, name.trim(), parseInt(rent) || 0, 'Open', (address || '').trim(), (manager || 'Unassigned').trim(), parseInt(staffCount) || 0, parseFloat(dailyTarget) || 0]
    );

    // Auto-create default stock items
    for (let idx = 0; idx < defaultStockItems.length; idx++) {
      const item = defaultStockItems[idx];
      const stockId = `stock-${id}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`;
      await pool.query(
        `INSERT INTO stock_items (id, unit, "minQty", "storeId", "itemName", "currentQty")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [stockId, item.unit, item.minQty, id, item.name, item.minQty * 2]
      );
    }

    const stores = await getStores();
    return NextResponse.json({ success: true, stores });
  } catch (err) {
    console.error('Create store error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/stores - Delete a store (admin only)
export async function DELETE(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { storeId } = await request.json();
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required.' }, { status: 400 });
    }

    // Unassign store managers linked to this store instead of deleting them
    await pool.query('UPDATE users SET "storeId" = NULL WHERE "storeId" = $1', [storeId]);
    
    // Soft delete the store by setting status to 'Archived'
    await pool.query("UPDATE stores SET status = 'Archived' WHERE id = $1", [storeId]);

    const stores = await getStores();
    const safeUsers = await getSafeUsers();

    return NextResponse.json({ success: true, stores, users: safeUsers });
  } catch (err) {
    console.error('Delete store error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
