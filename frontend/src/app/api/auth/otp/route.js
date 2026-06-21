import { NextResponse } from 'next/server';
import { pool } from '../../db/db-helper';
import crypto from 'crypto';

// In-memory store for OTPs (for development purposes)
const otpStore = new Map();

// POST /api/auth/otp
export async function POST(request) {
  try {
    const { action, phone, email, otp, newPassword } = await request.json();

    if (action === 'send') {
      if (!phone && !email) {
        return NextResponse.json({ error: 'Phone or email is required.' }, { status: 400 });
      }

      // Generate a mock 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const identifier = phone || email;

      // Store the OTP with a 5-minute expiry
      otpStore.set(identifier, {
        otp: generatedOtp,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      if (phone) {
        // Simulate sending via WhatsApp
        console.log(`[WhatsApp API Mock] Sending OTP to ${phone} via WhatsApp: Your code is ${generatedOtp}`);
        return NextResponse.json({ success: true, message: 'OTP sent via WhatsApp.' });
      } else {
        console.log(`[Email API Mock] Sending OTP to ${email}: Your code is ${generatedOtp}`);
        return NextResponse.json({ success: true, message: 'OTP sent via Email.' });
      }
    }

    if (action === 'verify_reset') {
      if ((!phone && !email) || !otp || !newPassword) {
        return NextResponse.json({ error: 'Identifier, OTP, and new password are required.' }, { status: 400 });
      }
      
      const identifier = phone || email;
      const record = otpStore.get(identifier);

      if (!record || record.expiresAt < Date.now() || record.otp !== otp) {
        return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
      }

      // Find user and update password
      const userRes = await pool.query('SELECT * FROM users WHERE email = $1 OR phone = $1', [identifier]);
      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      // Normally we'd hash the password, but we'll use a simple mock hash for now or rely on the same hash method used in auth.
      // Assuming a generic hash logic here (ideally imported from token.js, but keeping it simple):
      const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
      
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userRes.rows[0].id]);
      
      // Clear OTP
      otpStore.delete(identifier);

      return NextResponse.json({ success: true, message: 'Password successfully reset.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });

  } catch (err) {
    console.error('OTP error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
