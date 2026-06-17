import { NextResponse } from 'next/server';
import { getDb, saveDb } from '../../db/db-helper';
import { verifyToken } from '../../auth/token';

function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// POST /api/admin/menu - Add a new menu item (admin only)
export async function POST(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { name, category, price, calories, type, description, image } = await request.json();
    if (!name || !category || !price) {
      return NextResponse.json({ error: 'Name, category, and price are required.' }, { status: 400 });
    }

    const db = getDb();
    const { MENU_ITEMS } = await import('../../../store-data');
    const currentMenu = db.menu_items || MENU_ITEMS;

    const newItem = {
      id: `item-${Date.now()}`,
      name: name.trim(),
      category,
      price: parseFloat(price),
      calories: parseInt(calories) || 0,
      type: type || 'non-veg',
      description: (description || '').trim(),
      image: image || '🍗'
    };

    const updatedMenu = [...currentMenu, newItem];
    saveDb({ ...db, menu_items: updatedMenu });

    return NextResponse.json({ success: true, menu_items: updatedMenu });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/admin/menu - Update a menu item price (admin only)
export async function PUT(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { itemId, price } = await request.json();
    if (!itemId || price === undefined) {
      return NextResponse.json({ error: 'itemId and price are required.' }, { status: 400 });
    }

    const db = getDb();
    const { MENU_ITEMS } = await import('../../../store-data');
    const currentMenu = db.menu_items || MENU_ITEMS;

    const updatedMenu = currentMenu.map(item => {
      if (item.id === itemId) {
        return { ...item, price: parseFloat(price) };
      }
      return item;
    });

    saveDb({ ...db, menu_items: updatedMenu });
    return NextResponse.json({ success: true, menu_items: updatedMenu });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/menu - Delete a menu item (admin only)
export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required.' }, { status: 400 });
    }

    const db = getDb();
    const { MENU_ITEMS } = await import('../../../store-data');
    const currentMenu = db.menu_items || MENU_ITEMS;
    const updatedMenu = currentMenu.filter(item => item.id !== itemId);

    saveDb({ ...db, menu_items: updatedMenu });
    return NextResponse.json({ success: true, menu_items: updatedMenu });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
