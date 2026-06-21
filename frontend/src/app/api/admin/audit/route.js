import { NextResponse } from 'next/server';
import { pool } from '../../db/db-helper';
import { withRBAC, ROLES } from '../../auth/rbac';

// Only SUPER_ADMIN can view audit logs
async function getAuditLogsHandler(req) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const table = req.nextUrl.searchParams.get('table');

    let query = `
      SELECT id, table_name, action, old_data, new_data, timestamp
      FROM audit_logs
    `;
    let queryParams = [];

    if (table) {
      query += ` WHERE table_name = $1 `;
      queryParams.push(table);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    const { rows } = await pool.query(query, queryParams);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Audit Log Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withRBAC([ROLES.SUPER_ADMIN], getAuditLogsHandler);
