import { NextResponse } from 'next/server';
import { pool } from '../../db/db-helper';
import { withRBAC, ROLES } from '../rbac';

// Allow any authenticated user (Customer or Admin)
async function getMeHandler(req) {
  try {
    const userId = req.headers.get('x-user-id');
    const { rows } = await pool.query('SELECT id, name, email, role, "storeId", loyalty_points FROM users WHERE id = $1', [userId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Get Me Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withRBAC([ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.BRANCH_MANAGER, ROLES.CUSTOMER], getMeHandler);
