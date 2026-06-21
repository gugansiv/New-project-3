import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../db/db-helper';
import { verifyToken } from '../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

async function getMessagesForUser(user) {
  if (user.role === 'SUPER_ADMIN') {
    const res = await pool.query('SELECT * FROM messages ORDER BY timestamp ASC');
    return res.rows;
  } else {
    const res = await pool.query(
      'SELECT * FROM messages WHERE "storeId" = $1 OR "storeId" IS NULL ORDER BY timestamp ASC',
      [user.storeId]
    );
    return res.rows;
  }
}

// GET /api/messages - Retrieve operations channel messages
export async function GET(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'BRANCH_MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized. Store manager or admin access required.' }, { status: 401 });
  }

  try {
    const messages = await getMessagesForUser(user);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('Fetch messages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/messages - Post a new message to the channel
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'BRANCH_MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized. Store manager or admin access required.' }, { status: 401 });
  }

  try {
    const { text } = await request.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });
    }

    let storeName = 'System';
    if (user.storeId) {
      const storeRes = await pool.query('SELECT name FROM stores WHERE id = $1', [user.storeId]);
      if (storeRes.rows.length > 0) {
        storeName = storeRes.rows[0].name;
      }
    }

    const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    await pool.query(
      `INSERT INTO messages (id, text, sender, "storeId", "storeName", timestamp, "senderRole")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, text.trim(), user.name, user.storeId || null, storeName, timestamp, user.role]
    );

    const messages = await getMessagesForUser(user);
    return NextResponse.json({ success: true, messages });
  } catch (err) {
    console.error('Post message error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
