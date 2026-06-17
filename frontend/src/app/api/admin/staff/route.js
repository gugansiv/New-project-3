import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';
import { hashPassword } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// POST /api/admin/staff - Create a store manager (admin only)
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { name, email, password, storeId } = await request.json();
    if (!name || !email || !password || !storeId) {
      return NextResponse.json({ error: 'All fields (name, email, password, storeId) are required.' }, { status: 400 });
    }

    const db = getDb();

    // Check duplicate email
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const hashedPassword = hashPassword(password);
    const newManager = {
      id: `usr-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: 'store_manager',
      storeId
    };

    const updatedUsers = [...db.users, newManager];

    // Also update the store's manager field
    const updatedStores = db.stores.map(s => {
      if (s.id === storeId) {
        return { ...s, manager: name.trim() };
      }
      return s;
    });

    saveDb({ ...db, users: updatedUsers, stores: updatedStores });

    // Return without passwords
    const safeUsers = updatedUsers.map(({ password: _pw, ...rest }) => rest);
    return NextResponse.json({ 
      success: true, 
      users: safeUsers, 
      stores: updatedStores 
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/admin/staff - List users (admin only, no passwords)
export async function GET(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = getDb();
  const safeUsers = db.users.map(({ password, ...rest }) => rest);
  return NextResponse.json({ users: safeUsers });
}
