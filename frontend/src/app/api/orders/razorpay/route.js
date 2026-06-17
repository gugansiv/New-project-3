import { NextResponse } from 'next/server';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount is required and must be greater than zero.' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_T2egcwXRDwYrv9';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'ozFBLuw1FMxAWIjP5IKWw223';

    // Convert amount to paise (cents)
    const amountInPaise = Math.round(amount * 100);

    // Basic Auth string encoding
    const authString = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    // Create Razorpay order via official Razorpay API
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt-${Math.floor(100000 + Math.random() * 900000)}`
      })
    });

    const rzpData = await rzpResponse.json();

    if (!rzpResponse.ok) {
      return NextResponse.json({ 
        error: rzpData.error?.description || 'Razorpay order creation failed.' 
      }, { status: rzpResponse.status });
    }

    return NextResponse.json({
      success: true,
      keyId,
      orderId: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
