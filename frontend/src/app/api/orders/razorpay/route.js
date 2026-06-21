import { NextResponse } from 'next/server';
import { verifyToken } from '../../auth/token';
import { initDbTables } from '../../db/db-helper';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { amount } = body;

    // Validate amount bounds (INR paise limit, max 50,000 INR per order)
    if (!amount || amount <= 0 || amount > 50000) {
      return NextResponse.json({ error: 'Amount must be between 1 and 50,000 INR.' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('FATAL: Razorpay credentials are not configured on the server.');
    }

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
        receipt: `rcpt-${crypto.randomUUID()}`
      })
    });

    const rzpData = await rzpResponse.json();

    if (!rzpResponse.ok) {
      console.error('Razorpay API error response:', rzpData);
      return NextResponse.json({ 
        error: 'Razorpay order creation failed.' 
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
    console.error('Razorpay order creation route error:', err);
    return NextResponse.json({ error: 'An internal server error occurred while creating the payment order.' }, { status: 500 });
  }
}
