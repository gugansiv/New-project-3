import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../db/db-helper';

// GET /api/menu - Public: returns the menu items
export async function GET() {
  await initDbTables();
  try {
    const res = await pool.query('SELECT * FROM menu_items ORDER BY id ASC');
    const menuItems = res.rows.map(m => ({
      ...m,
      price: parseFloat(m.price || 0)
    }));
    return NextResponse.json({ menu_items: menuItems });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
