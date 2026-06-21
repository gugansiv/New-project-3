import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

async function getMenuItems() {
  const res = await pool.query('SELECT * FROM menu_items ORDER BY id ASC');
  return res.rows.map(m => ({
    ...m,
    price: parseFloat(m.price || 0)
  }));
}

// POST /api/admin/menu - Add a new menu item (admin only)
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { name, category, price, calories, type, description, image } = await request.json();
    if (!name || !category || !price) {
      return NextResponse.json({ error: 'Name, category, and price are required.' }, { status: 400 });
    }

    const id = `item-${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO menu_items (id, name, type, image, price, calories, category, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, name.trim(), type || 'non-veg', image || '🍗', parseFloat(price), parseInt(calories) || 0, category, (description || '').trim()]
    );

    console.log(`[AUDIT] Menu item created: ${id} (${name}) by admin ${user.email}`);

    const updatedMenu = await getMenuItems();
    return NextResponse.json({ success: true, menu_items: updatedMenu });
  } catch (err) {
    console.error('Create menu item error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/menu - Update a menu item price (admin only)
export async function PUT(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { itemId, price } = await request.json();
    if (!itemId || price === undefined) {
      return NextResponse.json({ error: 'itemId and price are required.' }, { status: 400 });
    }

    await pool.query(
      'UPDATE menu_items SET price = $1 WHERE id = $2',
      [parseFloat(price), itemId]
    );

    console.log(`[AUDIT] Menu item price updated: ${itemId} to ${price} by admin ${user.email}`);

    const updatedMenu = await getMenuItems();
    return NextResponse.json({ success: true, menu_items: updatedMenu });
  } catch (err) {
    console.error('Update menu item error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/menu - Delete a menu item (admin only)
export async function DELETE(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required.' }, { status: 400 });
    }

    await pool.query(
      'DELETE FROM menu_items WHERE id = $1',
      [itemId]
    );

    console.log(`[AUDIT] Menu item deleted: ${itemId} by admin ${user.email}`);

    const updatedMenu = await getMenuItems();
    return NextResponse.json({ success: true, menu_items: updatedMenu });
  } catch (err) {
    console.error('Delete menu item error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
