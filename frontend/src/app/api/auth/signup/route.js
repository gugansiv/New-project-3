import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../../db/db-helper';
import { hashPassword, generateToken } from '../token';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const db = getDb();
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const hashedPassword = hashPassword(password);
    const newUser = {
      id: `usr-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: 'customer',
      storeId: null
    };

    const updatedUsers = [...db.users, newUser];
    saveDb({
      ...db,
      users: updatedUsers
    });

    const token = generateToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      storeId: newUser.storeId
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        storeId: newUser.storeId
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
