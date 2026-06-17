import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// POST /api/orders/status - Update order status (store_manager or admin only)
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || (user.role !== 'admin' && user.role !== 'store_manager')) {
    return NextResponse.json({ error: 'Unauthorized. Store manager or admin access required.' }, { status: 401 });
  }

  try {
    const { orderId, newStatus } = await request.json();
    if (!orderId || !newStatus) {
      return NextResponse.json({ error: 'orderId and newStatus are required.' }, { status: 400 });
    }

    const db = getDb();
    let activeOrders = [...(db.active_orders || [])];
    let completedOrders = [...(db.completed_orders || [])];
    
    const orderIndex = activeOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      return NextResponse.json({ error: 'Order not found in active orders.' }, { status: 404 });
    }

    const order = activeOrders[orderIndex];

    // Check store_manager can only update orders for their store
    if (user.role === 'store_manager' && order.storeId !== user.storeId) {
      return NextResponse.json({ error: 'Access denied. This order is not from your store.' }, { status: 403 });
    }

    if (newStatus === 'Completed') {
      // Move from active to completed
      activeOrders.splice(orderIndex, 1);
      completedOrders = [{ ...order, status: 'Completed' }, ...completedOrders];
    } else {
      // Update status in-place
      activeOrders[orderIndex] = { ...order, status: newStatus };
    }

    saveDb({ ...db, active_orders: activeOrders, completed_orders: completedOrders });

    return NextResponse.json({ 
      success: true, 
      active_orders: activeOrders, 
      completed_orders: completedOrders 
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
