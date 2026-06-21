import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';

// GET /api/orders/track?id=<orderId> - Public: track a specific order status
export async function GET(request) {
  await initDbTables();
  const url = new URL(request.url);
  const orderId = url.searchParams.get('id');

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
  }

  try {
    const res = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const order = res.rows[0];
    const parsedOrder = {
      id: order.id,
      storeName: order.storeName,
      status: order.status,
      timestamp: order.timestamp,
      collectionTime: order.collectionTime,
      isActive: order.isActive,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    };

    return NextResponse.json({ order: parsedOrder });
  } catch (err) {
    console.error('Order tracking fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
