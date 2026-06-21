import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { hashPassword, generateToken } from '../token';
import { rateLimit, getClientIp } from '../rate-limiter';
import crypto from 'crypto';

export async function POST(request) {
  await initDbTables();
  const ip = getClientIp(request);
  const limitRes = rateLimit(ip, 3); // 3 attempts per minute
  if (!limitRes.success) {
    return NextResponse.json({ error: 'Too many signup attempts. Please try again in a minute.' }, { status: 429 });
  }

  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email address format.' }, { status: 400 });
    }

    // Password strength check (min 8 characters)
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    // Check duplicate
    const checkRes = await pool.query('SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (parseInt(checkRes.rows[0].count, 10) > 0) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const hashedPassword = hashPassword(password);
    const id = `usr-${crypto.randomUUID()}`;
    const userRole = 'customer';
    const storeId = null;

    await pool.query(
      `INSERT INTO users (id, name, email, password, role, "storeId")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name.trim(), email.trim().toLowerCase(), hashedPassword, userRole, storeId]
    );

    const token = generateToken({
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: userRole,
      storeId
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: userRole,
        storeId
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
