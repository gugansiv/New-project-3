/**
 * DB Sync Helper for Crispy Chicken Co.
 * Provides authenticated API calls using JWT tokens stored in sessionStorage.
 * Public endpoints (stores, menu) don't require auth.
 * Authenticated endpoints (orders, admin) require a Bearer token.
 */

// Token management
export function getToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('ccc_auth_token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('ccc_auth_token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('ccc_auth_token');
}

function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============ PUBLIC ENDPOINTS ============

export async function fetchStores() {
  try {
    const res = await fetch('/api/stores');
    if (!res.ok) throw new Error('Failed to fetch stores');
    const data = await res.json();
    return data.stores || [];
  } catch (err) {
    console.warn('Fetch stores failed:', err.message);
    return null;
  }
}

export async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('Failed to fetch menu');
    const data = await res.json();
    return data.menu_items || [];
  } catch (err) {
    console.warn('Fetch menu failed:', err.message);
    return null;
  }
}

// ============ AUTH ENDPOINTS ============

export async function apiLogin(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  setToken(data.token);
  return data;
}

export async function apiSignup(name, email, password) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Signup failed');
  }
  setToken(data.token);
  return data;
}

// ============ ORDER ENDPOINTS ============

export async function apiPlaceOrder(orderData) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(orderData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to place order');
  }
  return data;
}

export async function apiFetchOrders(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/orders${query ? `?${query}` : ''}`, {
    headers: authHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch orders');
  }
  return data;
}

export async function apiUpdateOrderStatus(orderId, newStatus) {
  const res = await fetch('/api/orders/status', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ orderId, newStatus })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update order status');
  }
  return data;
}

// ============ ADMIN ENDPOINTS ============

export async function apiAdminFetchDb() {
  const res = await fetch('/api/db', {
    headers: authHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch admin data');
  }
  return data;
}

export async function apiAdminPushDb(updates) {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to push updates');
  }
  return data;
}

export async function apiAdminCreateStaff(staffData) {
  const res = await fetch('/api/admin/staff', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(staffData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create staff');
  }
  return data;
}

export async function apiAdminFetchStaff() {
  const res = await fetch('/api/admin/staff', {
    headers: authHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch staff');
  }
  return data;
}

export async function apiAdminCreateStore(storeData) {
  const res = await fetch('/api/admin/stores', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(storeData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create store');
  }
  return data;
}

export async function apiAdminDeleteStore(storeId) {
  const res = await fetch('/api/admin/stores', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ storeId })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete store');
  }
  return data;
}

export async function apiAdminAddMenuItem(itemData) {
  const res = await fetch('/api/admin/menu', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(itemData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add menu item');
  }
  return data;
}

export async function apiAdminUpdateMenuPrice(itemId, price) {
  const res = await fetch('/api/admin/menu', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ itemId, price })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update price');
  }
  return data;
}

export async function apiAdminDeleteMenuItem(itemId) {
  const res = await fetch('/api/admin/menu', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ itemId })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete menu item');
  }
  return data;
}

// ============ LEGACY COMPATIBILITY ============
// These functions are kept for backward compatibility during transition
// but now route through authenticated endpoints where applicable.

export async function syncWithServer() {
  try {
    // For public data, no auth needed
    const stores = await fetchStores();
    const menu = await fetchMenu();

    // Try fetching orders if we have a token
    let activeOrders = [];
    let completedOrders = [];
    const token = getToken();
    if (token) {
      try {
        const orderData = await apiFetchOrders({ type: 'all' });
        activeOrders = orderData.active_orders || [];
        completedOrders = orderData.completed_orders || [];
      } catch (e) {
        // Token may be expired, silently fail
      }
    }

    // Update localStorage cache for offline support
    if (stores) localStorage.setItem('ccc_stores', JSON.stringify(stores));
    if (menu) localStorage.setItem('ccc_menu_items', JSON.stringify(menu));
    if (activeOrders.length > 0) localStorage.setItem('ccc_active_orders', JSON.stringify(activeOrders));
    if (completedOrders.length > 0) localStorage.setItem('ccc_completed_orders', JSON.stringify(completedOrders));

    return {
      stores: stores || [],
      menu_items: menu || [],
      active_orders: activeOrders,
      completed_orders: completedOrders
    };
  } catch (err) {
    console.warn('Server sync failed, running in offline mode:', err.message);
    return null;
  }
}

export async function pushToServer(updates) {
  // Legacy function — admin operations should use specific API endpoints
  // This is kept as a fallback but requires admin auth
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to push updates');
    return await res.json();
  } catch (err) {
    console.warn('Server push failed:', err.message);
    return null;
  }
}

// ============ STORE OPERATIONS ENDPOINTS ============

export async function apiFetchStoreOps(storeId) {
  const res = await fetch(`/api/store/ops?storeId=${storeId}`, {
    headers: authHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch store operations data');
  }
  return data;
}

export async function apiPostStoreOp(storeId, action, data) {
  const res = await fetch('/api/store/ops', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ storeId, action, data })
  });
  const resData = await res.json();
  if (!res.ok) {
    throw new Error(resData.error || 'Failed to execute store operation');
  }
  return resData;
}
