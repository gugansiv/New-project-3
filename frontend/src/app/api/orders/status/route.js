import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// POST /api/orders/status - Update order status (store_manager or admin only)
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'BRANCH_MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized. Store manager or admin access required.' }, { status: 401 });
  }

  try {
    const { orderId, newStatus } = await request.json();
    if (!orderId || !newStatus) {
      return NextResponse.json({ error: 'orderId and newStatus are required.' }, { status: 400 });
    }

    // Check order exists
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderRes.rows[0];

    // Check store_manager access
    if (user.role === 'BRANCH_MANAGER' && order.storeId !== user.storeId) {
      return NextResponse.json({ error: 'Access denied. This order is not from your store.' }, { status: 403 });
    }

    const isMovingToHistory = newStatus === 'Completed' || newStatus === 'Rejected';
    const isActive = !isMovingToHistory;

    // Update status and isActive in database
    await pool.query(
      'UPDATE orders SET status = $1, "isActive" = $2 WHERE id = $3',
      [newStatus, isActive, orderId]
    );

    console.log(`[AUDIT] Order ${orderId} status updated to ${newStatus} by ${user.email} (${user.role})`);

    // Fetch updated lists
    let queryText = 'SELECT * FROM orders WHERE 1=1';
    const queryParams = [];
    if (user.role === 'BRANCH_MANAGER') {
      queryText += ' AND "storeId" = $1';
      queryParams.push(user.storeId);
    }

    const allRes = await pool.query(queryText, queryParams);
    const allOrders = allRes.rows.map(o => ({
      ...o,
      subtotal: parseFloat(o.subtotal || 0),
      tax: parseFloat(o.tax || 0),
      total: parseFloat(o.total || 0)
    }));

    const activeOrders = allOrders.filter(o => o.isActive === true);
    const completedOrders = allOrders.filter(o => o.isActive === false);

    return NextResponse.json({ 
      success: true, 
      active_orders: activeOrders, 
      completed_orders: completedOrders 
    });
  } catch (err) {
    console.error('Update order status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
