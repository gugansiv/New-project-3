import { NextResponse } from 'next/server';
import { getDb } from '../db/db-helper';

// GET /api/stores - Public: returns the list of stores (no auth required)
export async function GET() {
  const db = getDb();
  return NextResponse.json({ stores: db.stores || [] });
}
