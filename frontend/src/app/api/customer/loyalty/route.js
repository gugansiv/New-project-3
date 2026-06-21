import { NextResponse } from 'next/server';
import { pool } from '../../../api/db/db-helper';
import { verifyToken } from '../../../api/auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// GET /api/customer/loyalty
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userRes = await pool.query('SELECT loyalty_points FROM users WHERE id = $1', [user.id]);
    const balance = userRes.rows.length > 0 ? userRes.rows[0].loyalty_points : 0;

    const txRes = await pool.query('SELECT * FROM loyalty_transactions WHERE "userId" = $1 ORDER BY timestamp DESC', [user.id]);
    
    return NextResponse.json({
      balance,
      transactions: txRes.rows
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
