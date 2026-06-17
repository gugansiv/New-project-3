import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../db/db-helper';
import { verifyToken } from '../auth/token';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// GET /api/orders - Get orders for the authenticated user
// If admin or store_manager, can filter by storeId query param
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const db = getDb();
  const url = new URL(request.url);
  const storeId = url.searchParams.get('storeId');
  const type = url.searchParams.get('type') || 'all'; // 'active', 'completed', 'all'

  let activeOrders = db.active_orders || [];
  let completedOrders = db.completed_orders || [];

  if (user.role === 'customer') {
    // Customers only see their own orders
    activeOrders = activeOrders.filter(o => o.customerEmail === user.email);
    completedOrders = completedOrders.filter(o => o.customerEmail === user.email);
  } else if (user.role === 'store_manager' && storeId) {
    // Store managers see orders for their store
    activeOrders = activeOrders.filter(o => o.storeId === storeId);
    completedOrders = completedOrders.filter(o => o.storeId === storeId);
  }
  // Admin sees all orders (no filter needed)

  if (type === 'active') return NextResponse.json({ active_orders: activeOrders });
  if (type === 'completed') return NextResponse.json({ completed_orders: completedOrders });
  return NextResponse.json({ active_orders: activeOrders, completed_orders: completedOrders });
}

// POST /api/orders - Place a new order (any authenticated user)
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      id, 
      storeId, 
      storeName, 
      items, 
      paymentMethod, 
      customerName, 
      paymentId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature
    } = body;

    if (!storeId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Store and items are required.' }, { status: 400 });
    }

    const db = getDb();

    // Verify the store exists and is open
    const store = (db.stores || []).find(s => s.id === storeId);
    if (!store || store.status !== 'Open') {
      return NextResponse.json({ error: 'Store is not available.' }, { status: 400 });
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    // Secure Signature Verification for Razorpay
    if (paymentMethod === 'Razorpay') {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return NextResponse.json({ error: 'Razorpay payment verification details are missing.' }, { status: 400 });
      }
      
      const keySecret = process.env.RAZORPAY_KEY_SECRET || 'ozFBLuw1FMxAWIjP5IKWw223';
      const text = razorpayOrderId + '|' + razorpayPaymentId;
      const generated_signature = crypto
        .createHmac('sha256', keySecret)
        .update(text)
        .digest('hex');

      if (generated_signature !== razorpaySignature) {
        return NextResponse.json({ error: 'Payment signature validation failed. Invalid transaction.' }, { status: 400 });
      }
    }

    const newOrder = {
      id: id || `ord-${Math.floor(1000 + Math.random() * 9000)}`,
      storeId,
      storeName: storeName || store.name,
      items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      status: 'Pending',
      timestamp: new Date().toISOString(),
      paymentMethod: paymentMethod || 'Card',
      paymentId: paymentId || null,
      customerName: customerName || user.name,
      customerEmail: user.email
    };

    const updatedActiveOrders = [...(db.active_orders || []), newOrder];
    saveDb({ ...db, active_orders: updatedActiveOrders });

    return NextResponse.json({ success: true, order: newOrder });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
