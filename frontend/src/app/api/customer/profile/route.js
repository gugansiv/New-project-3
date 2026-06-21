import { NextResponse } from 'next/server';
import { pool } from '../../../api/db/db-helper';
import { verifyToken } from '../../../api/auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// GET /api/customer/profile
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await pool.query('SELECT name, email, phone, saved_addresses, notification_preferences, loyalty_points FROM users WHERE id = $1', [user.id]);
    if (res.rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/customer/profile
export async function PUT(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, phone, saved_addresses, notification_preferences } = await request.json();
    
    await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        saved_addresses = COALESCE($3, saved_addresses),
        notification_preferences = COALESCE($4, notification_preferences)
       WHERE id = $5`,
      [name, phone, JSON.stringify(saved_addresses || []), JSON.stringify(notification_preferences || {}), user.id]
    );

    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
