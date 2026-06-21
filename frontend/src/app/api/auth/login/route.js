import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { verifyPassword, generateToken } from '../token';
import { rateLimit, getClientIp } from '../rate-limiter';

export async function POST(request) {
  await initDbTables();
  const ip = getClientIp(request);
  const limitRes = rateLimit(ip, 5); // 5 attempts per minute
  if (!limitRes.success) {
    return NextResponse.json({ error: 'Too many login attempts. Please try again in a minute.' }, { status: 429 });
  }

  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = res.rows[0];
    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
        loyalty_points: user.loyalty_points || 0
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
