import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../db/db-helper';
import { verifyToken } from '../auth/token';
import { rateLimit, getClientIp } from '../auth/rate-limiter';
import { enqueueNotification } from '../notifications/mockQueue';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// GET /api/orders - Get orders for the authenticated user
// If admin or store_manager, can filter by storeId query param
export async function GET(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get('storeId');
  const type = url.searchParams.get('type') || 'all'; // 'active', 'completed', 'all'

  try {
    let queryText = 'SELECT * FROM orders WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (user.role === 'customer') {
      queryText += ` AND "customerEmail" = $${paramIndex}`;
      queryParams.push(user.email);
      paramIndex++;
    } else if (user.role === 'BRANCH_MANAGER') {
      queryText += ` AND "storeId" = $${paramIndex}`;
      queryParams.push(user.storeId);
      paramIndex++;
    } else if (user.role === 'SUPER_ADMIN' && storeId) {
      queryText += ` AND "storeId" = $${paramIndex}`;
      queryParams.push(storeId);
      paramIndex++;
    }

    const allRes = await pool.query(queryText, queryParams);
    
    // Sort and parse numbers
    const allOrders = allRes.rows.map(o => ({
      ...o,
      subtotal: parseFloat(o.subtotal || 0),
      tax: parseFloat(o.tax || 0),
      total: parseFloat(o.total || 0)
    }));

    // Filter active vs completed
    const activeOrders = allOrders.filter(o => o.isActive === true);
    const completedOrders = allOrders.filter(o => o.isActive === false);

    if (type === 'active') return NextResponse.json({ active_orders: activeOrders });
    if (type === 'completed') return NextResponse.json({ completed_orders: completedOrders });
    return NextResponse.json({ active_orders: activeOrders, completed_orders: completedOrders });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/orders - Place a new order (any authenticated user)
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required to place orders.' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitRes = rateLimit(ip, 10); // 10 order requests per minute
  if (!limitRes.success) {
    return NextResponse.json({ error: 'Too many order requests. Please try again in a minute.' }, { status: 429 });
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
      razorpaySignature,
      customerPhone,
      collectionTime,
      redeemPoints
    } = body;

    if (!storeId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Store and items are required.' }, { status: 400 });
    }

    // Verify the store exists and is open
    const storeRes = await pool.query('SELECT name, status FROM stores WHERE id = $1', [storeId]);
    if (storeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Store not found.' }, { status: 400 });
    }
    const store = storeRes.rows[0];
    if (store.status !== 'Open') {
      return NextResponse.json({ error: 'Store is not available.' }, { status: 400 });
    }

    // Server-side price verification and sanitization
    const itemIds = items.map(item => item.id);
    if (itemIds.length === 0) {
      return NextResponse.json({ error: 'At least one item is required.' }, { status: 400 });
    }
    
    const placeholders = itemIds.map((_, i) => `$${i + 1}`).join(', ');
    const dbItemsRes = await pool.query(`SELECT id, price, name FROM menu_items WHERE id IN (${placeholders})`, itemIds);
    const dbItemsMap = {};
    dbItemsRes.rows.forEach(row => {
      dbItemsMap[row.id] = {
        price: parseFloat(row.price || 0),
        name: row.name
      };
    });

    let calculatedSubtotal = 0;
    const verifiedItems = [];
    for (const item of items) {
      const dbItem = dbItemsMap[item.id];
      if (!dbItem) {
        return NextResponse.json({ error: `Menu item with ID ${item.id} not found.` }, { status: 400 });
      }
      calculatedSubtotal += dbItem.price * item.quantity;
      verifiedItems.push({
        id: item.id,
        name: dbItem.name,
        quantity: item.quantity,
        price: dbItem.price
      });
    }

    const subtotal = calculatedSubtotal;
    const tax = subtotal * 0.08;
    
    // Calculate and verify loyalty point redemption securely on server
    let pointsDiscount = 0;
    if (redeemPoints && redeemPoints > 0) {
      if (user.role === 'customer') {
        const userRes = await pool.query('SELECT loyalty_points FROM users WHERE email = $1', [user.email]);
        if (userRes.rows.length > 0) {
          const availablePoints = parseFloat(userRes.rows[0].loyalty_points || 0);
          if (availablePoints >= redeemPoints) {
            const maxDiscount = subtotal; // Can only discount up to subtotal
            const requestedDiscount = redeemPoints / 10;
            pointsDiscount = Math.min(maxDiscount, requestedDiscount);
          } else {
             return NextResponse.json({ error: 'Insufficient loyalty points.' }, { status: 400 });
          }
        }
      }
    }
    
    const total = subtotal + tax - pointsDiscount;

    // Secure Signature Verification for Razorpay / Online Payment
    if (paymentMethod === 'Razorpay' || paymentMethod === 'Online') {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return NextResponse.json({ error: 'Payment details (razorpayPaymentId, razorpayOrderId, razorpaySignature) are required for online payments.' }, { status: 400 });
      }
      
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error('FATAL: RAZORPAY_KEY_SECRET is not configured on the server.');
      }
      
      const text = razorpayOrderId + '|' + razorpayPaymentId;
      const generated_signature = crypto
        .createHmac('sha256', keySecret)
        .update(text)
        .digest('hex');

      const a = Buffer.from(generated_signature, 'hex');
      const b = Buffer.from(razorpaySignature, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Payment signature validation failed. Invalid transaction.' }, { status: 400 });
      }
    }

    // Determine the final Order ID
    let finalOrderId = id;
    if (paymentMethod === 'Cash/Card') {
      const seqRes = await pool.query("SELECT value FROM system_settings WHERE key = 'lastCashCardSequence'");
      const lastSeq = seqRes.rows[0]?.value || 'B40';
      let charCode = lastSeq.charCodeAt(0);
      let numPart = parseInt(lastSeq.substring(1), 10);

      numPart += 1;
      if (numPart > 99) {
        numPart = 0;
        charCode += 1;
        if (charCode > 90) { // Wrap past Z to A
          charCode = 65;
        }
      }

      const nextSeq = String.fromCharCode(charCode) + numPart.toString().padStart(2, '0');
      finalOrderId = nextSeq;
      
      // Save nextSeq to settings
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ('lastCashCardSequence', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [nextSeq]
      );
    } else {
      finalOrderId = id || `ord-${crypto.randomUUID()}`;
    }

    // Verify order ID uniqueness
    if (finalOrderId) {
      const orderExists = await pool.query('SELECT 1 FROM orders WHERE id = $1', [finalOrderId]);
      if (orderExists.rows.length > 0) {
        return NextResponse.json({ error: 'Order ID already exists.' }, { status: 400 });
      }
    }

    const orderTimestamp = new Date().toISOString();
    const newOrder = {
      id: finalOrderId,
      storeId,
      storeName: storeName || store.name,
      items: verifiedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      status: 'Pending',
      timestamp: orderTimestamp,
      paymentMethod: paymentMethod || 'Online',
      paymentId: paymentId || null,
      customerName: customerName || user.name,
      customerEmail: user.email,
      customerPhone: customerPhone || '',
      collectionTime: collectionTime || 'Now',
      isActive: true
    };

    // Insert order into table
    await pool.query(
      `INSERT INTO orders (id, "storeId", "storeName", items, subtotal, tax, total, status, timestamp, "paymentMethod", "paymentId", "customerName", "customerEmail", "customerPhone", "collectionTime", "isActive")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        newOrder.id,
        newOrder.storeId,
        newOrder.storeName,
        JSON.stringify(newOrder.items),
        newOrder.subtotal,
        newOrder.tax,
        newOrder.total,
        newOrder.status,
        newOrder.timestamp,
        newOrder.paymentMethod,
        newOrder.paymentId,
        newOrder.customerName,
        newOrder.customerEmail,
        newOrder.customerPhone,
        newOrder.collectionTime,
        newOrder.isActive
      ]
    );

    // Reward points (1 pt per 100 spent) OR Deduct points if redeemed
    let pointsEarned = 0;
    if (user && user.role === 'customer') {
      if (pointsDiscount > 0) {
        const actualPointsDeducted = pointsDiscount * 10;
        await pool.query('UPDATE users SET loyalty_points = loyalty_points - $1 WHERE email = $2', [actualPointsDeducted, user.email]);
        await pool.query(
          `INSERT INTO loyalty_transactions (id, "userId", amount, type, description) VALUES ($1, $2, $3, $4, $5)`,
          ['ltx-' + Date.now() + Math.floor(Math.random()*1000), user.id, actualPointsDeducted, 'Redeemed', `Redeemed on order ${newOrder.id}`]
        );
      } else {
        pointsEarned = Math.floor(total / 100) * 10;
        if (pointsEarned > 0) {
          await pool.query(
            `UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE LOWER(email) = LOWER($2)`,
            [pointsEarned, user.email]
          );
          await pool.query(
            `INSERT INTO loyalty_transactions (id, "userId", amount, type, description) VALUES ($1, $2, $3, $4, $5)`,
            ['ltx-' + Date.now() + Math.floor(Math.random()*1000), user.id, pointsEarned, 'Earned', `Earned on order ${newOrder.id}`]
          );
        }
      }
    }

    console.log(`[AUDIT] Order ${newOrder.id} placed for store ${newOrder.storeId} by user ${user.email} (${user.role}). Earned ${pointsEarned} pts.`);

    // Enqueue WhatsApp notification
    if (newOrder.customerPhone) {
      enqueueNotification({
        type: 'whatsapp',
        to: newOrder.customerPhone,
        payload: {
          message: `Hi ${newOrder.customerName}, your Crispy Chicken Co. order ${newOrder.id} is confirmed! Amount: ₹${newOrder.total}. You earned ${pointsEarned} loyalty points.`
        }
      });
    }

    return NextResponse.json({ success: true, order: newOrder, pointsEarned });
  } catch (err) {
    console.error('Order creation error:', err);
    return NextResponse.json({ error: 'An internal server error occurred while placing your order.' }, { status: 500 });
  }
}
