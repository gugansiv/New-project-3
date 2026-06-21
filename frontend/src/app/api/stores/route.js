import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../db/db-helper';

// GET /api/stores - Public: returns the list of stores (no auth required)
export async function GET() {
  await initDbTables();
  try {
    const res = await pool.query('SELECT * FROM stores ORDER BY name ASC');
    return NextResponse.json({ stores: res.rows });
  } catch (err) {
    console.error('Fetch stores public error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
