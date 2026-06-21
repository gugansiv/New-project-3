import { NextResponse } from 'next/server';
import { pool, initDbTables } from '../../db/db-helper';
import { verifyToken, hashPassword } from '../../auth/token';
import crypto from 'crypto';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

async function getSafeUsers() {
  const res = await pool.query('SELECT id, name, email, role, "storeId" FROM users ORDER BY name ASC');
  return res.rows;
}

async function getStores() {
  const res = await pool.query("SELECT * FROM stores WHERE status != 'Archived' ORDER BY name ASC");
  return res.rows.map(s => ({
    ...s,
    rent: parseFloat(s.rent || 0),
    dailyTarget: parseFloat(s.dailyTarget || 0),
    historicalRevenue: parseFloat(s.historicalRevenue || 0)
  }));
}

// GET /api/admin/staff - List users (admin only, no passwords)
export async function GET(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const safeUsers = await getSafeUsers();
    return NextResponse.json({ users: safeUsers });
  } catch (err) {
    console.error('Fetch staff error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/staff - Create a store manager (admin only)
export async function POST(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { name, email, password, storeId } = await request.json();
    if (!name || !email || !password || !storeId) {
      return NextResponse.json({ error: 'All fields (name, email, password, storeId) are required.' }, { status: 400 });
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

    // Check duplicate email
    const dupCheck = await pool.query('SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (parseInt(dupCheck.rows[0].count, 10) > 0) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const hashedPassword = hashPassword(password);
    const newId = `usr-${crypto.randomUUID()}`;

    // Insert user
    await pool.query(
      `INSERT INTO users (id, name, email, password, role, "storeId")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId, name.trim(), email.trim().toLowerCase(), hashedPassword, 'BRANCH_MANAGER', storeId]
    );

    // Update store manager field
    await pool.query(
      'UPDATE stores SET manager = $1 WHERE id = $2',
      [name.trim(), storeId]
    );

    const safeUsers = await getSafeUsers();
    const stores = await getStores();

    return NextResponse.json({ 
      success: true, 
      users: safeUsers, 
      stores 
    });
  } catch (err) {
    console.error('Create staff error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/staff - Update a store manager (admin only)
export async function PUT(request) {
  await initDbTables();
  const user = getAuthUser(request);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { id, name, email, password, storeId } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'User ID (id) is required.' }, { status: 400 });
    }

    // Build update query dynamically
    let queryText = 'UPDATE users SET ';
    const queryParams = [];
    let paramIndex = 1;

    if (name) {
      queryText += `name = $${paramIndex}, `;
      queryParams.push(name.trim());
      paramIndex++;
    }
    if (email) {
      queryText += `email = $${paramIndex}, `;
      queryParams.push(email.trim().toLowerCase());
      paramIndex++;
    }
    if (password) {
      queryText += `password = $${paramIndex}, `;
      queryParams.push(hashPassword(password));
      paramIndex++;
    }
    if (storeId !== undefined) {
      queryText += `"storeId" = $${paramIndex}, `;
      queryParams.push(storeId);
      paramIndex++;
    }

    // Remove trailing comma and space
    queryText = queryText.slice(0, -2);
    queryText += ` WHERE id = $${paramIndex}`;
    queryParams.push(id);

    await pool.query(queryText, queryParams);

    // Get current manager details to update the stores manager mapping
    const managerRes = await pool.query('SELECT name, "storeId" FROM users WHERE id = $1', [id]);
    if (managerRes.rows.length > 0) {
      const manager = managerRes.rows[0];
      if (manager.storeId) {
        await pool.query(
          'UPDATE stores SET manager = $1 WHERE id = $2',
          [manager.name, manager.storeId]
        );
      }
    }

    const safeUsers = await getSafeUsers();
    const stores = await getStores();

    return NextResponse.json({ 
      success: true, 
      users: safeUsers, 
      stores 
    });
  } catch (err) {
    console.error('Update staff error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
