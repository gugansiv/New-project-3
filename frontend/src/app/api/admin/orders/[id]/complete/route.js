import { NextResponse } from 'next/server';
import { pool } from '../../../../db/db-helper';
import { withRBAC, ROLES } from '../../../../auth/rbac';

async function markCompleteHandler(req, { params }) {
  try {
    const orderId = params.id;
    const userRole = req.headers.get('x-user-role');
    const userStoreId = req.headers.get('x-user-store');

    // Fetch the order
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orderRes.rows[0];

    // Branch managers can only complete their own store's orders
    if (userRole === ROLES.BRANCH_MANAGER && order.storeId !== userStoreId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update order
    await pool.query('UPDATE orders SET "isActive" = false, status = $1 WHERE id = $2', ['Completed', orderId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Order complete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withRBAC([ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.BRANCH_MANAGER], markCompleteHandler);
