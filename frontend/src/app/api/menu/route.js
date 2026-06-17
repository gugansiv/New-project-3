import { NextResponse } from 'next/server';
import { getDb } from '../db/db-helper';

// GET /api/menu - Public: returns the menu items
export async function GET() {
  const db = getDb();
  const { MENU_ITEMS } = await import('../../store-data');
  const menuItems = db.menu_items || MENU_ITEMS;
  return NextResponse.json({ menu_items: menuItems });
}
