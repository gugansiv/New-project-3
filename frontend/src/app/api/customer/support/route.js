import { NextResponse } from 'next/server';
import { pool } from '../../../api/db/db-helper';
import { verifyToken } from '../../../api/auth/token';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// GET /api/customer/support
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await pool.query('SELECT * FROM support_tickets WHERE "userId" = $1 ORDER BY created_at DESC', [user.id]);
    return NextResponse.json(res.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/customer/support
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { subject, message, priority = 'Normal' } = await request.json();
    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const ticketId = 'tic-' + Date.now();
    await pool.query(
      `INSERT INTO support_tickets (id, "userId", subject, message, priority, status)
       VALUES ($1, $2, $3, $4, $5, 'Open')`,
      [ticketId, user.id, subject, message, priority]
    );

    return NextResponse.json({ success: true, ticketId, message: 'Support ticket submitted' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
