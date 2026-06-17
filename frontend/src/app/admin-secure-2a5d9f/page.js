'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { INITIAL_STORES, HISTORICAL_ORDERS, MENU_ITEMS } from '../store-data';
import { 
  syncWithServer, 
  pushToServer, 
  apiLogin, 
  apiAdminCreateStaff, 
  apiAdminDeleteStore, 
  apiAdminCreateStore, 
  apiAdminFetchStaff, 
  getToken, 
  setToken, 
  clearToken,
  apiAdminFetchDb,
  apiAdminPushDb
} from '../db-sync';

export default function AdminPortal() {
  const [stores, setStores] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeTab, setActiveTab] = useState('stores'); // 'stores', 'menu', 'orders', 'staff', 'financials'

  // New store form state
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreManager, setNewStoreManager] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreRent, setNewStoreRent] = useState('');
  const [newStoreStaff, setNewStoreStaff] = useState('');
  const [newStoreTarget, setNewStoreTarget] = useState('');
  const [showAddStore, setShowAddStore] = useState(false);

  // New menu item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Buckets');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCalories, setNewItemCalories] = useState('');
  const [newItemType, setNewItemType] = useState('non-veg');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);

  // Edit price states
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemPrice, setEditingItemPrice] = useState('');

  // Auth states
  const [currentUser, setCurrentUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Staff management states
  const [users, setUsers] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffStoreId, setNewStaffStoreId] = useState('');

  // Store Operations States
  const [dailyReports, setDailyReports] = useState([]);
  const [stockOrders, setStockOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [wasteLog, setWasteLog] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [opsSelectedStoreId, setOpsSelectedStoreId] = useState('');

  // Fetch full Admin DB (reports and stock orders)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;

    const fetchAdminData = async () => {
      try {
        const data = await apiAdminFetchDb();
        if (data.daily_reports) setDailyReports(data.daily_reports);
        if (data.stock_orders) setStockOrders(data.stock_orders);
        if (data.expenses) setExpenses(data.expenses);
        if (data.shifts) setShifts(data.shifts);
        if (data.waste_log) setWasteLog(data.waste_log);
        if (data.stock_items) setStockItems(data.stock_items);
        
        // Auto-select first store if none selected
        if (data.stores && data.stores.length > 0 && !opsSelectedStoreId) {
          setOpsSelectedStoreId(data.stores[0].id);
        }
      } catch (err) {
        console.warn("Failed fetching admin data:", err.message);
      }
    };

    fetchAdminData();
    const interval = setInterval(fetchAdminData, 4000);
    return () => clearInterval(interval);
  }, [currentUser, opsSelectedStoreId]);

  const handleApproveReport = async (reportId) => {
    try {
      const db = await apiAdminFetchDb();
      const updatedReports = db.daily_reports.map(r => {
        if (r.id === reportId) return { ...r, status: 'Approved' };
        return r;
      });
      await apiAdminPushDb({ daily_reports: updatedReports });
      setDailyReports(updatedReports);
      alert("Daily report approved!");
    } catch (err) {
      alert("Failed to approve report: " + err.message);
    }
  };

  const handleApproveStockOrder = async (orderId) => {
    try {
      const db = await apiAdminFetchDb();
      const order = db.stock_orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedOrders = db.stock_orders.map(o => {
        if (o.id === orderId) return { ...o, status: 'Approved' };
        return o;
      });

      const updatedStock = db.stock_items.map(item => {
        if (item.storeId === order.storeId) {
          const orderedItem = order.items.find(i => i.itemName === item.itemName);
          if (orderedItem) {
            return { ...item, currentQty: item.currentQty + orderedItem.quantity };
          }
        }
        return item;
      });

      await apiAdminPushDb({ 
        stock_orders: updatedOrders,
        stock_items: updatedStock
      });
      setStockOrders(updatedOrders);
      alert("Restock order approved and inventory dispatched!");
    } catch (err) {
      alert("Failed to approve stock order: " + err.message);
    }
  };

  // Initialize data from localStorage & sync with server
  useEffect(() => {
    const init = async () => {
      await syncWithServer();

      // Load users from server if admin is logged in
      const token = getToken();
      if (token) {
        try {
          const staffData = await apiAdminFetchStaff();
          if (staffData.users) setUsers(staffData.users);
        } catch (e) {
          // Token may be expired
          const savedUsers = localStorage.getItem('ccc_users');
          if (savedUsers) setUsers(JSON.parse(savedUsers));
        }
      } else {
        const savedUsers = localStorage.getItem('ccc_users');
        if (savedUsers) setUsers(JSON.parse(savedUsers));
      }

      // Current User
      const savedUser = localStorage.getItem('ccc_current_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }

      // Stores
      const savedStores = localStorage.getItem('ccc_stores');
      if (savedStores) {
        setStores(JSON.parse(savedStores));
      } else {
        localStorage.setItem('ccc_stores', JSON.stringify(INITIAL_STORES));
        setStores(INITIAL_STORES);
      }

      // Menu Items
      const savedMenu = localStorage.getItem('ccc_menu_items');
      if (savedMenu) {
        setMenuItems(JSON.parse(savedMenu));
      } else {
        localStorage.setItem('ccc_menu_items', JSON.stringify(MENU_ITEMS));
        setMenuItems(MENU_ITEMS);
      }

      // Active Orders
      const savedActive = localStorage.getItem('ccc_active_orders');
      if (savedActive) {
        setActiveOrders(JSON.parse(savedActive));
      } else {
        localStorage.setItem('ccc_active_orders', JSON.stringify([]));
        setActiveOrders([]);
      }

      // Completed Orders
      const savedCompleted = localStorage.getItem('ccc_completed_orders');
      if (savedCompleted) {
        setCompletedOrders(JSON.parse(savedCompleted));
      } else {
        localStorage.setItem('ccc_completed_orders', JSON.stringify(HISTORICAL_ORDERS));
        setCompletedOrders(HISTORICAL_ORDERS);
      }
    };

    init();
  }, []);


  // Poll local storage & sync server for changes
  useEffect(() => {
    const pollStorage = async () => {
      await syncWithServer();

      const active = localStorage.getItem('ccc_active_orders');
      if (active) setActiveOrders(JSON.parse(active));

      const completed = localStorage.getItem('ccc_completed_orders');
      if (completed) setCompletedOrders(JSON.parse(completed));

      const savedStores = localStorage.getItem('ccc_stores');
      if (savedStores) setStores(JSON.parse(savedStores));

      const savedMenu = localStorage.getItem('ccc_menu_items');
      if (savedMenu) setMenuItems(JSON.parse(savedMenu));

      const savedUsers = localStorage.getItem('ccc_users');
      if (savedUsers) setUsers(JSON.parse(savedUsers));

      const savedCurrentUser = localStorage.getItem('ccc_current_user');
      if (savedCurrentUser) {
        const parsed = JSON.parse(savedCurrentUser);
        if (!currentUser || currentUser.email !== parsed.email) {
          setCurrentUser(parsed);
        }
      } else if (currentUser) {
        setCurrentUser(null);
      }
    };

    const interval = setInterval(pollStorage, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Sync helpers
  const saveStoresToStorage = (updatedStores) => {
    localStorage.setItem('ccc_stores', JSON.stringify(updatedStores));
    setStores(updatedStores);
    pushToServer({ stores: updatedStores });
  };

  const saveMenuToStorage = (updatedMenu) => {
    localStorage.setItem('ccc_menu_items', JSON.stringify(updatedMenu));
    setMenuItems(updatedMenu);
    pushToServer({ menu_items: updatedMenu });
  };

  const saveActiveOrdersToStorage = (updatedOrders) => {
    localStorage.setItem('ccc_active_orders', JSON.stringify(updatedOrders));
    setActiveOrders(updatedOrders);
    pushToServer({ active_orders: updatedOrders });
  };

  const saveCompletedOrdersToStorage = (updatedOrders) => {
    localStorage.setItem('ccc_completed_orders', JSON.stringify(updatedOrders));
    setCompletedOrders(updatedOrders);
    pushToServer({ completed_orders: updatedOrders });
  };

  // Admin Auth Handlers
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!adminEmail || !adminPassword) {
      setAuthError('Email and Password are required.');
      return;
    }
    try {
      const data = await apiLogin(adminEmail, adminPassword);
      if (data.user.role !== 'admin') {
        clearToken();
        setAuthError('Invalid admin credentials.');
        return;
      }
      localStorage.setItem('ccc_current_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setAdminEmail('');
      setAdminPassword('');

      // Now fetch staff list with the new token
      try {
        const staffData = await apiAdminFetchStaff();
        if (staffData.users) setUsers(staffData.users);
      } catch (e) {
        // Ignore
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('ccc_current_user');
    clearToken();
    setCurrentUser(null);
  };

  // Staff creation action
  const handleAddStaff = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!newStaffName || !newStaffEmail || !newStaffPassword || !newStaffStoreId) {
      alert('All fields are required.');
      return;
    }
    try {
      const data = await apiAdminCreateStaff({
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        storeId: newStaffStoreId
      });
      if (data.users) {
        setUsers(data.users);
        localStorage.setItem('ccc_users', JSON.stringify(data.users));
      }
      if (data.stores) {
        setStores(data.stores);
        localStorage.setItem('ccc_stores', JSON.stringify(data.stores));
      }
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffStoreId('');
      alert('Store Manager login created successfully.');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = (userId) => {
    if (userId === 'usr-admin') {
      alert('Cannot delete global admin.');
      return;
    }
    if (confirm('Are you sure you want to delete this user?')) {
      const usersList = JSON.parse(localStorage.getItem('ccc_users') || '[]');
      const updatedUsers = usersList.filter(u => u.id !== userId);
      localStorage.setItem('ccc_users', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
      pushToServer({ users: updatedUsers });
    }
  };

  // Menu item actions
  const handleAddMenuItem = (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) {
      alert('Name and Price are required.');
      return;
    }

    const defaultImage = newItemCategory === 'Drinks' 
      ? 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=60'
      : newItemCategory === 'Sides'
        ? 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=60'
        : 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60';

    const newItem = {
      id: `food-${Math.floor(100 + Math.random() * 900)}`,
      name: newItemName,
      category: newItemCategory,
      price: parseFloat(newItemPrice),
      calories: parseInt(newItemCalories) || 0,
      type: newItemType,
      description: newItemDescription || 'Crispy delicious menu selection prepared fresh.',
      image: newItemImage.trim() || defaultImage
    };

    const updatedMenu = [...menuItems, newItem];
    saveMenuToStorage(updatedMenu);

    // Reset Form
    setNewItemName('');
    setNewItemCategory('Buckets');
    setNewItemPrice('');
    setNewItemCalories('');
    setNewItemType('non-veg');
    setNewItemDescription('');
    setNewItemImage('');
    setShowAddItem(false);
  };

  const handleDeleteMenuItem = (itemId) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
      const updatedMenu = menuItems.filter(item => item.id !== itemId);
      saveMenuToStorage(updatedMenu);
    }
  };

  const handleStartEditPrice = (item) => {
    setEditingItemId(item.id);
    setEditingItemPrice(item.price.toString());
  };

  const handleSaveItemPrice = (itemId) => {
    const newPrice = parseFloat(editingItemPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      alert('Please enter a valid price.');
      return;
    }

    const updatedMenu = menuItems.map(item => {
      if (item.id === itemId) {
        return { ...item, price: newPrice };
      }
      return item;
    });

    saveMenuToStorage(updatedMenu);
    setEditingItemId(null);
  };

  // Order management
  const updateOrderStatus = (orderId, newStatus) => {
    const orderToUpdate = activeOrders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    if (newStatus === 'Completed') {
      const completedOrder = {
        ...orderToUpdate,
        status: 'Completed',
        completedTimestamp: new Date().toISOString()
      };

      const updatedActive = activeOrders.filter(o => o.id !== orderId);
      const updatedCompleted = [completedOrder, ...completedOrders];

      saveActiveOrdersToStorage(updatedActive);
      saveCompletedOrdersToStorage(updatedCompleted);

      // Add revenue to corresponding store
      const updatedStores = stores.map(store => {
        if (store.id === orderToUpdate.storeId) {
          return {
            ...store,
            historicalRevenue: (store.historicalRevenue || 0) + orderToUpdate.total,
            historicalOrders: (store.historicalOrders || 0) + 1
          };
        }
        return store;
      });
      saveStoresToStorage(updatedStores);

    } else {
      const updatedActive = activeOrders.map(o => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });
      saveActiveOrdersToStorage(updatedActive);
    }
  };

  const cancelOrder = (orderId) => {
    const updatedActive = activeOrders.filter(o => o.id !== orderId);
    saveActiveOrdersToStorage(updatedActive);
  };

  // Store management
  const toggleStoreStatus = (storeId) => {
    const updatedStores = stores.map(s => {
      if (s.id === storeId) {
        return { ...s, status: s.status === 'Open' ? 'Closed' : 'Open' };
      }
      return s;
    });
    saveStoresToStorage(updatedStores);
  };

  const handleAddStore = async (e) => {
    e.preventDefault();
    if (!newStoreName || !newStoreManager || !newStoreAddress) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      const data = await apiAdminCreateStore({
        name: newStoreName,
        address: newStoreAddress,
        manager: newStoreManager,
        rent: parseFloat(newStoreRent) || 150000,
        staffCount: parseInt(newStoreStaff) || 5,
        dailyTarget: parseFloat(newStoreTarget) || 75000
      });
      if (data.stores) {
        setStores(data.stores);
        localStorage.setItem('ccc_stores', JSON.stringify(data.stores));
      }

      setNewStoreName('');
      setNewStoreManager('');
      setNewStoreAddress('');
      setNewStoreRent('');
      setNewStoreStaff('');
      setNewStoreTarget('');
      setShowAddStore(false);
    } catch (err) {
      alert('Failed to create store: ' + err.message);
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (confirm('Are you sure you want to delete this store location? This will also unassign any managers linked to it.')) {
      try {
        const data = await apiAdminDeleteStore(storeId);
        if (data.stores) {
          setStores(data.stores);
          localStorage.setItem('ccc_stores', JSON.stringify(data.stores));
        }
        if (data.users) {
          setUsers(data.users);
          localStorage.setItem('ccc_users', JSON.stringify(data.users));
        }
      } catch (err) {
        alert('Failed to delete store: ' + err.message);
      }
    }
  };

  // Financial Calculations
  const getStoreFinancials = (store) => {
    const revenue = store.historicalRevenue || 0;
    const cogs = revenue * 0.35;
    const marketing = revenue * 0.08;
    const labor = (store.staffCount || 5) * 25000;
    const rent = store.rent || 150000;
    const totalExpenses = cogs + marketing + labor + rent;
    const netProfit = revenue - totalExpenses;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      cogs,
      marketing,
      labor,
      rent,
      totalExpenses,
      netProfit,
      margin
    };
  };

  const financialData = stores.map(store => ({
    store,
    financials: getStoreFinancials(store)
  }));

  // Overview Stats
  const totalRevenue = financialData.reduce((sum, d) => sum + d.financials.revenue, 0);
  const totalCompletedOrdersCount = completedOrders.length;
  const activeOrdersCount = activeOrders.length;
  const totalOrders = totalCompletedOrdersCount + activeOrdersCount;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const openStoresCount = stores.filter(s => s.status === 'Open').length;

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F8F9FA] min-h-screen font-sans antialiased text-black">
        <title>Admin Lockscreen | Crispy Chicken Co.</title>
        <div className="h-1.5 bg-[#E4002B] absolute top-0 left-0 right-0"></div>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 border border-gray-200/50 flex flex-col gap-6 text-center animate-scale-in">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1 h-8 items-stretch justify-center">
              <div className="w-1.5 bg-[#E4002B]"></div>
              <div className="w-1.5 bg-[#E4002B]"></div>
              <div className="w-1.5 bg-[#E4002B]"></div>
            </div>
            <h1 className="text-xl font-black tracking-tight text-black mt-2">
              CRISPY CHICKEN <span className="text-[#E4002B]">CO.</span>
            </h1>
            <span className="bg-neutral-100 text-neutral-800 text-[9px] font-black border border-neutral-200 px-2 py-0.5 rounded uppercase tracking-widest mt-1">
              Admin Portal Authorization
            </span>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg text-left">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Admin Email</label>
              <input
                type="email"
                required
                placeholder="admin@crispy.com"
                className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-all tracking-wide shadow-sm font-bold mt-2"
            >
              Unlock Dashboard 🔓
            </button>
          </form>

          <div className="text-[10px] text-gray-400 font-bold border-t border-gray-100 pt-4">
            Security Gate. For administrative access only.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FA] font-sans antialiased text-black">
      <title>Admin Control Center | Crispy Chicken Co.</title>
      
      {/* Top red bar */}
      <div className="h-1.5 bg-[#E4002B] w-full"></div>

      {/* Admin Nav */}
      <header className="bg-white border-b border-gray-200 px-4 py-3.5 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1 h-6 items-stretch">
              <div className="w-1 bg-[#E4002B]"></div>
              <div className="w-1 bg-[#E4002B]"></div>
              <div className="w-1 bg-[#E4002B]"></div>
            </div>
            <span className="text-xl font-black tracking-tight text-black select-none">
              CRISPY CHICKEN <span className="text-[#E4002B]">CO.</span>
            </span>
            <span className="bg-neutral-100 text-neutral-800 text-[10px] font-black border border-neutral-200 px-2 py-0.5 rounded uppercase tracking-wider">
              Control Panel
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-gray-700 hidden sm:inline">Logged in as: Admin</span>
            <button
              onClick={handleAdminLogout}
              className="px-3 py-1.5 border border-gray-300 hover:border-[#E4002B] text-gray-600 hover:text-[#E4002B] font-extrabold text-xs uppercase rounded-full bg-white transition-colors"
            >
              Logout 🔒
            </button>
            <Link 
              href="/" 
              className="px-4 py-1.5 border border-gray-300 font-extrabold text-xs uppercase bg-white text-gray-700 hover:text-black hover:bg-gray-55 rounded-full transition-colors"
            >
              View Storefront ➜
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-8">
        
        {/* Overview Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Gross Sales</span>
            <h3 className="text-2xl font-black tracking-tight mt-1 text-[#E4002B]">
              ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>All stores live totals</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Transactions</span>
            <h3 className="text-2xl font-black tracking-tight mt-1 text-black">
              {totalOrders}
            </h3>
            <p className="text-[10px] text-gray-500 font-bold mt-2">
              {activeOrdersCount} in Queue | {totalCompletedOrdersCount} Completed
            </p>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Average Order Value</span>
            <h3 className="text-2xl font-black tracking-tight mt-1 text-black">
              ₹{aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-gray-500">
              <span>AOV benchmark target: ₹250</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Operational Outlets</span>
            <h3 className="text-2xl font-black tracking-tight mt-1 text-emerald-600">
              {openStoresCount} <span className="text-gray-400 text-lg font-bold">/ {stores.length}</span>
            </h3>
            <p className="text-[10px] text-gray-500 font-bold mt-2">Open stores accepting orders</p>
          </div>
        </section>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-200 mb-8 gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'stores', label: '📍 Store Outlets', badge: stores.length },
            { id: 'menu', label: '🍔 Menu Maintenance', badge: menuItems.length },
            { id: 'orders', label: '🛎️ Orders Queue', badge: activeOrdersCount },
            { id: 'staff', label: '👥 Staff Management', badge: null },
            { id: 'financials', label: '📊 Financial Ledger', badge: null },
            { 
              id: 'operations', 
              label: '🏢 Store Operations', 
              badge: (dailyReports.filter(r => r.status === 'Pending').length + stockOrders.filter(o => o.status === 'Pending').length) || null 
            }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 font-black text-sm uppercase transition-all shrink-0 border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? 'border-[#E4002B] text-[#E4002B]'
                  : 'border-transparent text-gray-500 hover:text-black'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.badge !== null && (
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    tab.id === 'orders' && activeOrdersCount > 0 
                      ? 'bg-[#E4002B] text-white animate-pulse' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab 1: Store Outlets */}
        {activeTab === 'stores' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <h2 className="text-base font-black uppercase text-black">Outlet Directory</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Toggle outlet operations, review baseline data, or open new store locations.</p>
              </div>
              <button
                onClick={() => setShowAddStore(!showAddStore)}
                className="px-4 py-1.5 bg-black hover:bg-neutral-800 text-white font-black text-xs uppercase rounded-full transition-all shadow-sm"
              >
                {showAddStore ? 'Close Form' : '➕ Create New Outlet'}
              </button>
            </div>

            {/* Add Store Collapsible Panel Form */}
            {showAddStore && (
              <form onSubmit={handleAddStore} className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 max-w-2xl shadow-sm">
                <h3 className="text-sm font-black uppercase text-black border-b border-gray-100 pb-2">Add New Location Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Store Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Northside Drive-Thru"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Manager Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Robert Smith"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newStoreManager}
                      onChange={(e) => setNewStoreManager(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 500 Central Ave, New York, NY"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newStoreAddress}
                      onChange={(e) => setNewStoreAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Monthly Rent (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 150000"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newStoreRent}
                      onChange={(e) => setNewStoreRent(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Staff Count</label>
                    <input
                      type="number"
                      placeholder="e.g. 8"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newStoreStaff}
                      onChange={(e) => setNewStoreStaff(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Daily Target (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 75000"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newStoreTarget}
                      onChange={(e) => setNewStoreTarget(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddStore(false)}
                    className="px-4 py-1.5 border border-gray-300 rounded-full font-bold text-xs uppercase bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm"
                  >
                    Add Location
                  </button>
                </div>
              </form>
            )}

            {/* Grid of Store Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stores.map(store => {
                const isOpen = store.status === 'Open';

                return (
                  <div 
                    key={store.id} 
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-300 transition-all flex flex-col justify-between h-56"
                  >
                    <div>
                      {/* Store Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-black text-base">{store.name}</h3>
                          <span className="text-[10px] text-gray-400 font-bold block mt-0.5">{store.address}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded border uppercase ${
                          isOpen 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-red-50 border-red-200 text-[#E4002B]'
                        }`}>
                          {store.status}
                        </span>
                      </div>

                      {/* Store Meta Info Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] font-bold text-gray-500 border-t border-b border-gray-100 py-3">
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider">Manager</span>
                          <span className="text-black font-extrabold mt-0.5 block truncate">{store.manager}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider">Staff Size</span>
                          <span className="text-black font-extrabold mt-0.5 block">{store.staffCount} Workers</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider">Gross Sales</span>
                          <span className="text-black font-extrabold mt-0.5 block truncate text-[#E4002B]">
                            ₹{store.historicalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Store Action Footer */}
                    <div className="flex justify-between items-center mt-auto pt-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleStoreStatus(store.id)}
                          className={`px-3 py-1.5 border rounded-full text-[10px] font-black uppercase transition-colors ${
                            isOpen
                              ? 'border-red-300 text-[#E4002B] hover:bg-red-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isOpen ? 'Close' : 'Open'}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteStore(store.id)}
                          className="px-3 py-1.5 border border-red-200 hover:border-red-600 text-red-500 hover:text-white hover:bg-[#E4002B] rounded-full text-[10px] font-black uppercase transition-all"
                          title="Delete Store Location"
                        >
                          🗑️
                        </button>
                      </div>

                      <Link
                        href={`/store/${store.id}`}
                        className="px-4 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-full text-[10px] font-black uppercase transition-colors tracking-wide flex items-center gap-1 shadow-sm font-bold"
                      >
                        Console ⚙️
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stock replenishment requests section */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-8 animate-scale-in">
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-black font-sans">Store Stock Replenishment Orders ({stockOrders.length})</h3>
                <span className="text-[10px] font-black text-gray-500 uppercase">Requests Console</span>
              </div>
              <div className="p-4 space-y-4">
                {stockOrders.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-6 text-center">No restock requests submitted.</p>
                ) : (
                  stockOrders.map(order => (
                    <div key={order.id} className="p-4 bg-neutral-50 rounded-xl border border-gray-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-black">{order.storeName}</span>
                          <span className="text-[9px] bg-neutral-200 text-neutral-800 font-black px-1.5 py-0.5 rounded border border-neutral-300">ID: {order.id}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold block mt-1">Requested by {order.requestedBy} on {new Date(order.timestamp).toLocaleString()}</span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {order.items.map((item, idx) => (
                            <span key={idx} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold text-gray-700">
                              {item.itemName} <span className="font-extrabold text-[#E4002B]">+{item.quantity} {item.unit}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                          order.status === 'Approved' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                        }`}>
                          {order.status}
                        </span>
                        {order.status !== 'Approved' && (
                          <button
                            onClick={() => handleApproveStockOrder(order.id)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm"
                          >
                            Approve & Dispatch ✓
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Menu Maintenance */}
        {activeTab === 'menu' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <h2 className="text-base font-black uppercase text-black">Customer Menu Manager</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Maintain customer order page items, prices, descriptions, and categories.</p>
              </div>
              <button
                onClick={() => setShowAddItem(!showAddItem)}
                className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-all shadow-sm"
              >
                {showAddItem ? 'Close Form' : '➕ Create Menu Item'}
              </button>
            </div>

            {/* Add Menu Item Collapsible Panel Form */}
            {showAddItem && (
              <form onSubmit={handleAddMenuItem} className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 max-w-2xl shadow-sm">
                <h3 className="text-sm font-black uppercase text-black border-b border-gray-100 pb-2">Add New Menu Selection</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Item Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Double Crunch Combo"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Category *</label>
                    <select
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 299.00"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Calories (kcal)</label>
                    <input
                      type="number"
                      placeholder="e.g. 650"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newItemCalories}
                      onChange={(e) => setNewItemCalories(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Type *</label>
                    <div className="flex gap-4 py-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="itemType"
                          value="non-veg"
                          checked={newItemType === 'non-veg'}
                          onChange={() => setNewItemType('non-veg')}
                          className="accent-[#E4002B]"
                        />
                        Non-Veg 🔴
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="itemType"
                          value="veg"
                          checked={newItemType === 'veg'}
                          onChange={() => setNewItemType('veg')}
                          className="accent-emerald-600"
                        />
                        Veg 🟢
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Custom Image URL (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. https://image-url.com"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newItemImage}
                      onChange={(e) => setNewItemImage(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Description</label>
                    <textarea
                      placeholder="Give a mouth-watering description..."
                      rows="2"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddItem(false)}
                    className="px-4 py-1.5 border border-gray-300 rounded-full font-bold text-xs uppercase bg-white text-gray-700 hover:bg-gray-55 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm"
                  >
                    Save Menu Item
                  </button>
                </div>
              </form>
            )}

            {/* Menu Items Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100/50 text-gray-500 border-b border-gray-200 uppercase font-black">
                      <th className="p-3">Preview</th>
                      <th className="p-3">Item Details</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                    {menuItems.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-50/50">
                        <td className="p-3">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-md border border-gray-100 shrink-0"
                          />
                        </td>
                        <td className="p-3">
                          <div className="text-black font-extrabold text-sm">{item.name}</div>
                          <div className="text-[10px] text-gray-400 font-bold max-w-xs truncate">{item.description}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5">🔥 {item.calories} kcal</div>
                        </td>
                        <td className="p-3">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-extrabold uppercase text-[9px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3 uppercase">
                          <span className={item.type === 'veg' ? 'text-emerald-600' : 'text-[#E4002B]'}>
                            {item.type} {item.type === 'veg' ? '🟢' : '🔴'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {editingItemId === item.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-right font-extrabold text-black text-xs"
                                value={editingItemPrice}
                                onChange={(e) => setEditingItemPrice(e.target.value)}
                              />
                              <button
                                onClick={() => handleSaveItemPrice(item.id)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-2 py-0.5 font-extrabold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-black font-extrabold text-sm">₹{item.price.toFixed(2)}</span>
                              <button
                                onClick={() => handleStartEditPrice(item)}
                                className="text-gray-400 hover:text-black font-bold"
                                title="Edit Price"
                              >
                                ✎
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="text-gray-400 hover:text-red-600 font-extrabold uppercase text-[10px] transition-colors px-2 py-1"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Tab 3: Orders Queue */}
        {activeTab === 'orders' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <h2 className="text-base font-black uppercase text-black">Global Active Orders Queue</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Overview of active storefront orders across all outlets.</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Global Sync
              </span>
            </div>

            {activeOrders.length === 0 ? (
              <div className="bg-white border border-gray-200 p-12 text-center rounded-xl flex flex-col items-center justify-center shadow-sm">
                <span className="text-4xl mb-3 select-none">📭</span>
                <h3 className="text-base font-black text-black">No active orders at this time</h3>
                <p className="text-xs text-gray-500 font-bold mt-1 max-w-xs">New orders placed by customers on the storefront will appear here instantly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeOrders.map(order => (
                  <div key={order.id} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:border-gray-300 transition-colors">
                    <div>
                      {/* Top Header */}
                      <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
                        <div>
                          <span className="text-[10px] font-black text-[#A16207] uppercase bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{order.storeName}</span>
                          <h4 className="text-base font-black text-black mt-1.5">{order.id}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase ${
                          order.status === 'Pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          order.status === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          order.status === 'Frying' ? 'bg-red-50 text-[#E4002B] border-red-200 animate-pulse' :
                          'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-3 mb-6">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Ordered Items</span>
                        <ul className="space-y-1.5">
                          {order.items.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center text-xs font-bold text-gray-700">
                              <span>
                                <span className="font-extrabold text-[#E4002B]">{item.quantity}x</span> {item.name}
                              </span>
                              <span className="text-black font-extrabold">₹{(item.price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        
                        <div className="border-t border-dashed border-gray-200 pt-3 mt-3 flex justify-between items-center">
                          <div className="text-[10px] font-bold text-gray-500">
                            Customer: <span className="text-black font-extrabold">{order.customerName}</span> | Pay: <span className="text-black font-extrabold">{order.paymentMethod}</span>
                          </div>
                          <div className="text-base font-black text-black">
                            Total: <span className="text-[#E4002B]">₹{order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Control Actions */}
                    <div className="border-t border-gray-100 pt-4 mt-auto flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex gap-2">
                        {order.status === 'Pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'Preparing')}
                            className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm"
                          >
                            Accept Order
                          </button>
                        )}
                        {order.status === 'Preparing' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'Frying')}
                            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm"
                          >
                            Start Cooking
                          </button>
                        )}
                        {order.status === 'Frying' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'Out for Delivery')}
                            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm"
                          >
                            Dispatch Order
                          </button>
                        )}
                        {order.status === 'Out for Delivery' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'Completed')}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                      
                      <button
                        onClick={() => cancelOrder(order.id)}
                        className="px-3 py-1.5 text-gray-400 hover:text-red-600 font-extrabold text-[10px] uppercase transition-colors"
                      >
                        Cancel Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Staff Management */}
        {activeTab === 'staff' && (
          <section className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
              <div>
                <h2 className="text-base font-black uppercase text-black font-sans">Staff Login Registry</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Create and maintain logins for Store Managers and view user records.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Create new login form */}
              <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm space-y-4 self-start">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-2.5">Create Store Manager Login</h3>
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Manager Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Vance"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. marcus@crispy.com"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Store Assignment</label>
                    <select
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                      value={newStaffStoreId}
                      onChange={(e) => setNewStaffStoreId(e.target.value)}
                      required
                    >
                      <option value="">Select an outlet...</option>
                      {stores.map(store => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors tracking-wide shadow-sm"
                  >
                    Create Manager Account
                  </button>
                </form>
              </div>

              {/* Right Column: User registry table */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-2.5">User Registry Database</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-neutral-50 text-gray-500 border-b border-gray-200 uppercase font-black">
                        <th className="p-3">User</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Store Link</th>
                        <th className="p-3">Password</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                      {users.map((user, idx) => {
                        const assignedStore = stores.find(s => s.id === user.storeId);
                        return (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="p-3">
                              <span className="text-black font-extrabold block">{user.name}</span>
                              <span className="text-[10px] text-gray-400 font-semibold block">{user.email}</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${
                                user.role === 'admin' ? 'bg-red-50 border-red-200 text-[#E4002B]' :
                                user.role === 'store_manager' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                'bg-sky-50 border-sky-200 text-sky-700'
                              }`}>
                                {user.role.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-black font-extrabold">
                              {assignedStore ? assignedStore.name : <span className="text-gray-400 font-bold">N/A</span>}
                            </td>
                            <td className="p-3 font-mono text-[10px] text-gray-400">
                              {user.password}
                            </td>
                            <td className="p-3 text-center">
                              {user.id !== 'usr-admin' ? (
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-[#E4002B] hover:text-red-800 font-black uppercase text-[10px]"
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="text-gray-300 font-black uppercase text-[10px] select-none">System</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Financial Ledger */}
        {activeTab === 'financials' && (
          <section className="space-y-8">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
              <div>
                <h2 className="text-base font-black uppercase text-black font-sans">Financial Ledger & Balance Sheet</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Aggregate system balance sheets, cost splits, and completed logs.</p>
              </div>
              <span className="text-xs font-black bg-neutral-100 border border-gray-200 text-neutral-800 px-3.5 py-1 rounded-full">
                Ledger Year: 2026
              </span>
            </div>

            {/* Financial comparison charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Store revenue bar chart */}
              <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
                <h3 className="text-xs font-black uppercase text-black mb-5 border-b border-gray-100 pb-2">Revenue Share Comparison (₹)</h3>
                <div className="space-y-4.5">
                  {financialData.map(({ store, financials }) => {
                    const percent = totalRevenue > 0 ? (financials.revenue / totalRevenue) * 100 : 0;
                    return (
                      <div key={store.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-gray-700">
                          <span>{store.name}</span>
                          <span className="text-[#E4002B] font-extrabold">₹{financials.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden relative border border-gray-200/50">
                          <div
                            style={{ width: `${percent}%` }}
                            className="h-full bg-[#E4002B] rounded-full transition-all duration-500"
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Profit Margin comparison */}
              <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
                <h3 className="text-xs font-black uppercase text-black mb-5 border-b border-gray-100 pb-2">Net Profit Margin (%)</h3>
                <div className="space-y-4.5">
                  {financialData.map(({ store, financials }) => {
                    const margin = financials.margin;
                    const isPositive = margin >= 0;
                    const displayPercent = Math.min(Math.max(Math.abs(margin), 0), 100);

                    return (
                      <div key={store.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-gray-700">
                          <span>{store.name}</span>
                          <span className={`font-extrabold ${isPositive ? 'text-emerald-600' : 'text-[#E4002B]'}`}>
                            {isPositive ? '+' : '-'}{Math.abs(margin).toFixed(1)}% Net Margin
                          </span>
                        </div>
                        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden relative border border-gray-200/50">
                          <div
                            style={{ width: `${displayPercent}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-[#E4002B]'}`}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Financial Sheets Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-black uppercase text-black">Network Balance Sheet Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100/50 text-gray-500 border-b border-gray-200 uppercase font-black">
                      <th className="p-4">Location</th>
                      <th className="p-4 text-right">Revenue</th>
                      <th className="p-4 text-right">Lease Cost</th>
                      <th className="p-4 text-right">Labor Cost</th>
                      <th className="p-4 text-right">COGS (35%)</th>
                      <th className="p-4 text-right">Marketing (8%)</th>
                      <th className="p-4 text-right">Total expenses</th>
                      <th className="p-4 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                    {financialData.map(({ store, financials }) => (
                      <tr key={store.id} className="hover:bg-neutral-50/50">
                        <td className="p-4 text-black font-extrabold">{store.name}</td>
                        <td className="p-4 text-right text-black font-extrabold">₹{financials.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-4 text-right text-gray-500">₹{financials.rent.toLocaleString()}</td>
                        <td className="p-4 text-right text-gray-500">₹{financials.labor.toLocaleString()}</td>
                        <td className="p-4 text-right text-gray-500">₹{financials.cogs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="p-4 text-right text-gray-500">₹{financials.marketing.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="p-4 text-right text-gray-500">₹{financials.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`p-4 text-right font-black ${financials.netProfit >= 0 ? 'text-emerald-600' : 'text-[#E4002B]'}`}>
                          ₹{financials.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Sum Totals Row */}
                    <tr className="bg-gray-50 border-t border-gray-200 font-black text-black text-sm">
                      <td className="p-4 uppercase font-black text-xs">Total Network</td>
                      <td className="p-4 text-right text-[#E4002B]">₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-gray-700 text-xs">₹{financialData.reduce((sum, d) => sum + d.financials.rent, 0).toLocaleString()}</td>
                      <td className="p-4 text-right text-gray-700 text-xs">₹{financialData.reduce((sum, d) => sum + d.financials.labor, 0).toLocaleString()}</td>
                      <td className="p-4 text-right text-gray-700 text-xs">₹{financialData.reduce((sum, d) => sum + d.financials.cogs, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-gray-700 text-xs">₹{financialData.reduce((sum, d) => sum + d.financials.marketing, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-gray-700 text-xs">₹{financialData.reduce((sum, d) => sum + d.financials.totalExpenses, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`p-4 text-right text-[#E4002B] ${(totalRevenue - financialData.reduce((sum, d) => sum + d.financials.totalExpenses, 0)) >= 0 ? 'text-emerald-600' : 'text-[#E4002B]'}`}>
                        ₹{(totalRevenue - financialData.reduce((sum, d) => sum + d.financials.totalExpenses, 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historical Order Ledger */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-black">Complete Transactions Journal</h3>
                <span className="text-[10px] font-black text-gray-500 uppercase">Logged logs: {completedOrders.length}</span>
              </div>
              <div className="overflow-y-auto max-h-96">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-neutral-50 text-gray-500 border-b border-gray-200 uppercase font-black sticky top-0 bg-white">
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Outlet Name</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Method</th>
                      <th className="p-3 text-right">Items</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                    {completedOrders.map((order, idx) => {
                      const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                      return (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="p-3 text-black font-extrabold">{order.id}</td>
                          <td className="p-3 font-medium">{new Date(order.timestamp).toLocaleString()}</td>
                          <td className="p-3">{order.storeName}</td>
                          <td className="p-3">{order.customerName}</td>
                          <td className="p-3">{order.paymentMethod}</td>
                          <td className="p-3 text-right">{itemCount} items</td>
                          <td className="p-3 text-right text-black font-extrabold">₹{order.total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Reports list */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-8 animate-scale-in">
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-black font-sans">Store Operator Daily Reports ({dailyReports.length})</h3>
                <span className="text-[10px] font-black text-gray-500 uppercase">Audit Ledger</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-50 text-gray-500 border-b border-gray-200 uppercase font-black">
                      <th className="p-3">Store Name</th>
                      <th className="p-3">Report Date</th>
                      <th className="p-3 text-right">Gross Sales</th>
                      <th className="p-3 text-right">Expenses</th>
                      <th className="p-3 text-right">Waste</th>
                      <th className="p-3 text-center">Alerts (Staff / Stock)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                    {dailyReports.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-gray-400 font-bold">No daily reports received.</td>
                      </tr>
                    ) : (
                      dailyReports.map(rep => (
                        <tr key={rep.id} className="hover:bg-neutral-50/50">
                          <td className="p-3 text-black font-extrabold">{rep.storeName}</td>
                          <td className="p-3">{rep.date}</td>
                          <td className="p-3 text-right text-emerald-600">₹{rep.totalSales.toFixed(2)}</td>
                          <td className="p-3 text-right text-[#E4002B]">-₹{rep.totalExpenses.toFixed(2)}</td>
                          <td className="p-3 text-right text-orange-600">-₹{rep.totalWaste.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            {rep.activeShiftsCount} shifts / {rep.stockAlertsCount} alerts
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                              rep.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {rep.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {rep.status !== 'Approved' && (
                              <button
                                onClick={() => handleApproveReport(rep.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-full transition-colors"
                              >
                                Approve ✓
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Tab 6: Store Operations Hub */}
        {activeTab === 'operations' && (
          <section className="space-y-8 animate-scale-in">
            {/* Header banner */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-base font-black uppercase text-black font-sans">🏢 Store Operations Hub</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Verify and audit daily store operations, track real-time activity status, and approve stock replenishment orders.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-xs font-black bg-amber-50 border border-amber-200 text-amber-700 px-3.5 py-1.5 rounded-full">
                  ⚠️ {stockOrders.filter(o => o.status === 'Pending').length} Pending Restocks
                </span>
                <span className="text-xs font-black bg-blue-50 border border-blue-200 text-blue-700 px-3.5 py-1.5 rounded-full">
                  📊 {dailyReports.filter(r => r.status === 'Pending').length} Pending Reports
                </span>
              </div>
            </div>

            {/* 1. Overall Network Status Progress (Overall Store Report) */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase text-black mb-5 border-b border-gray-100 pb-2 tracking-wider">
                Overall Outlet Progress & Status Monitor
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-50 text-gray-400 border-b border-gray-200 uppercase font-black">
                      <th className="p-3">Store Name</th>
                      <th className="p-3">Outlet Status</th>
                      <th className="p-3 text-right">Today's Sales</th>
                      <th className="p-3 text-right">Expenses Logged</th>
                      <th className="p-3 text-right">Food Waste</th>
                      <th className="p-3 text-center">Active Shifts</th>
                      <th className="p-3 text-center">Stock Alerts</th>
                      <th className="p-3">Restock Orders</th>
                      <th className="p-3">Daily Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                    {stores.map(st => {
                      const storeExpenses = expenses.filter(e => e.storeId === st.id);
                      const storeShifts = shifts.filter(s => s.storeId === st.id);
                      const storeWaste = wasteLog.filter(w => w.storeId === st.id);
                      const storeStock = stockItems.filter(s => s.storeId === st.id);
                      
                      const totalStoreSales = completedOrders.filter(o => o.storeId === st.id).reduce((sum, o) => sum + o.total, 0);
                      const totalStoreExp = storeExpenses.reduce((sum, e) => sum + e.amount, 0);
                      const totalStoreWaste = storeWaste.reduce((sum, w) => sum + w.cost, 0);
                      const activeShiftsCount = storeShifts.filter(s => !s.clockOut).length;
                      const lowStockCount = storeStock.filter(s => s.currentQty <= s.minQty).length;
                      
                      const pendingRestocks = stockOrders.filter(o => o.storeId === st.id && o.status === 'Pending').length;
                      const storeReports = dailyReports.filter(r => r.storeId === st.id);
                      const latestReport = storeReports[storeReports.length - 1];

                      return (
                        <tr key={st.id} className="hover:bg-neutral-50/50">
                          <td className="p-3 text-black font-extrabold">{st.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase ${
                              st.status === 'Open' 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-red-50 border-red-200 text-[#E4002B]'
                            }`}>
                              {st.status}
                            </span>
                          </td>
                          <td className="p-3 text-right text-emerald-600">₹{totalStoreSales.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#E4002B]">₹{totalStoreExp.toLocaleString()}</td>
                          <td className="p-3 text-right text-orange-600">₹{totalStoreWaste.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase ${
                              activeShiftsCount > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'
                            }`}>
                              {activeShiftsCount} Active
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase ${
                              lowStockCount > 0 ? 'bg-red-50 text-[#E4002B] border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {lowStockCount} Alert{lowStockCount !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="p-3">
                            {pendingRestocks > 0 ? (
                              <span className="bg-amber-50 text-amber-700 text-[8px] font-black border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                {pendingRestocks} Pending ⚠️
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">All Healthy ✓</span>
                            )}
                          </td>
                          <td className="p-3">
                            {latestReport ? (
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${
                                latestReport.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {latestReport.status} ({latestReport.date})
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">No Reports</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Detail Explorer (Individual Store Audit) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* Store Selector Sidebar */}
              <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 tracking-wider">
                  Select Store to Audit
                </h3>
                <div className="flex flex-col gap-2">
                  {stores.map(st => (
                    <button
                      key={st.id}
                      onClick={() => setOpsSelectedStoreId(st.id)}
                      className={`text-left p-3 rounded-lg border text-xs font-bold transition-all ${
                        opsSelectedStoreId === st.id
                          ? 'border-[#E4002B] bg-red-50/30 text-[#E4002B] font-extrabold'
                          : 'border-gray-200 hover:bg-neutral-50 text-gray-700'
                      }`}
                    >
                      <span className="block">{st.name}</span>
                      <span className="text-[10px] text-gray-400 font-normal mt-0.5 block">{st.manager} | {st.address.split(',')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Store Details View */}
              <div className="lg:col-span-3 space-y-6">
                {!opsSelectedStoreId ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center">
                    <span className="text-4xl mb-3">🏢</span>
                    <h4 className="text-sm font-black text-black">Select an outlet to view audit files</h4>
                    <p className="text-xs text-gray-500 font-bold mt-1">Detailed inventory alerts, logged expenses, employee timing logs, and waste counts will load here.</p>
                  </div>
                ) : (() => {
                  const selStore = stores.find(s => s.id === opsSelectedStoreId);
                  if (!selStore) return null;
                  const selExpenses = expenses.filter(e => e.storeId === opsSelectedStoreId);
                  const selShifts = shifts.filter(s => s.storeId === opsSelectedStoreId);
                  const selWaste = wasteLog.filter(w => w.storeId === opsSelectedStoreId);
                  const selStock = stockItems.filter(s => s.storeId === opsSelectedStoreId);

                  return (
                    <div className="space-y-6">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center animate-scale-in">
                        <div>
                          <h3 className="text-sm font-black uppercase text-black">{selStore.name} — Full Details & Status</h3>
                          <span className="text-[10px] text-gray-400 font-bold mt-0.5">Operational Audit Console</span>
                        </div>
                        <span className="text-xs font-black bg-neutral-100 border border-gray-200 text-neutral-800 px-3 py-1 rounded">
                          Store ID: {selStore.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Stock Inventory Audit */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-2.5 tracking-wider">
                            🥔 Inventory Alert Status
                          </h4>
                          {selStock.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-4 text-center">No inventory items loaded.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selStock.map(item => {
                                const isLow = item.currentQty <= item.minQty;
                                return (
                                  <div key={item.id} className="flex justify-between items-center text-xs font-bold text-gray-700">
                                    <span>{item.itemName}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-black font-extrabold">{item.currentQty} / {item.minQty} {item.unit}</span>
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                        isLow ? 'bg-red-50 text-[#E4002B] border border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}>
                                        {isLow ? 'Low' : 'OK'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Shift Work Logs */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-2.5 tracking-wider">
                            ⏱️ Today's Staff Timing Logs
                          </h4>
                          {selShifts.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-4 text-center">No shift records found for today.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selShifts.map(shift => (
                                <div key={shift.id} className="flex justify-between items-center text-xs font-bold text-gray-700 p-2 bg-neutral-50 rounded border border-gray-200/50">
                                  <div>
                                    <span className="text-black font-extrabold block">{shift.staffName}</span>
                                    <span className="text-[9px] text-gray-400 font-normal block mt-0.5">
                                      {new Date(shift.clockIn).toLocaleTimeString()} - {shift.clockOut ? new Date(shift.clockOut).toLocaleTimeString() : 'Clocked In'}
                                    </span>
                                  </div>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                    !shift.clockOut ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {!shift.clockOut ? 'Active' : 'Clocked Out'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Logged Expenses Ledger */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-2.5 tracking-wider">
                            💸 Custom Expenses Logged
                          </h4>
                          {selExpenses.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-4 text-center">No custom expenses logged today.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selExpenses.map(exp => (
                                <div key={exp.id} className="flex justify-between items-center text-xs font-bold text-gray-700 border-b border-gray-100 pb-2">
                                  <div>
                                    <span className="text-black font-extrabold">{exp.description || exp.category}</span>
                                    <span className="text-[9px] text-gray-400 font-normal block mt-0.5">{new Date(exp.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <span className="text-[#E4002B] font-extrabold">₹{exp.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Wasted Ingredients Log */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-2.5 tracking-wider">
                            🗑️ Food Spoilage & Wastage Log
                          </h4>
                          {selWaste.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-4 text-center">No wastage entries logged today.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selWaste.map(waste => (
                                <div key={waste.id} className="flex justify-between items-center text-xs font-bold text-gray-700 border-b border-gray-100 pb-2">
                                  <div>
                                    <span className="text-black font-extrabold">{waste.itemName} (x{waste.quantity})</span>
                                    <span className="text-[9px] text-gray-400 font-normal block mt-0.5">Reason: {waste.reason}</span>
                                  </div>
                                  <span className="text-[#E4002B] font-extrabold">₹{waste.cost.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* 3. Verification & Validation Control Desk (Stock Requests & Reports) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Validation Desk: Stock Requests */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 tracking-wider">
                  📋 Restock Requests Validation Desk
                </h3>
                {stockOrders.filter(o => o.status === 'Pending').length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-6 text-center">No pending stock requests require verification.</p>
                ) : (
                  <div className="space-y-4">
                    {stockOrders.filter(o => o.status === 'Pending').map(order => (
                      <div key={order.id} className="p-4 bg-neutral-50 rounded-xl border border-gray-200/50 flex flex-col justify-between gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-black text-black">{order.storeName}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">By {order.requestedBy} | {new Date(order.timestamp).toLocaleString()}</span>
                          </div>
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase font-black">
                            ID: {order.id}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {order.items.map((item, idx) => (
                            <span key={idx} className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[10px] font-bold text-gray-700">
                              {item.itemName} <span className="font-extrabold text-[#E4002B]">+{item.quantity} {item.unit}</span>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-gray-100 mt-1 justify-end">
                          <button
                            onClick={async () => {
                              try {
                                const db = await apiAdminFetchDb();
                                const updatedOrders = db.stock_orders.map(o => {
                                  if (o.id === order.id) return { ...o, status: 'Rejected' };
                                  return o;
                                });
                                await apiAdminPushDb({ stock_orders: updatedOrders });
                                setStockOrders(updatedOrders);
                                alert("Restock request rejected.");
                              } catch (err) {
                                alert("Failed to reject order: " + err.message);
                              }
                            }}
                            className="px-4 py-1.5 border border-red-200 text-[#E4002B] hover:bg-red-50 text-[10px] font-black uppercase rounded-full transition-colors"
                          >
                            Reject ✕
                          </button>
                          <button
                            onClick={() => handleApproveStockOrder(order.id)}
                            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-full transition-colors"
                          >
                            Verify & Dispatch ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Validation Desk: Daily Reports */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 tracking-wider">
                  📊 Daily Reports Audit & Approval Desk
                </h3>
                {dailyReports.filter(r => r.status === 'Pending').length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-6 text-center">No pending daily reports require audit approval.</p>
                ) : (
                  <div className="space-y-4">
                    {dailyReports.filter(r => r.status === 'Pending').map(rep => (
                      <div key={rep.id} className="p-4 bg-neutral-50 rounded-xl border border-gray-200/50 flex flex-col justify-between gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-black text-black">{rep.storeName}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">Submitted by {rep.submittedBy} on {new Date(rep.submittedAt).toLocaleTimeString()}</span>
                          </div>
                          <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded uppercase font-black">
                            Date: {rep.date}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 py-2 text-center bg-white rounded border border-gray-100">
                          <div className="p-1">
                            <span className="text-[8px] font-black text-gray-400 uppercase block">Sales</span>
                            <span className="text-xs font-extrabold text-emerald-600">₹{rep.totalSales.toLocaleString()}</span>
                          </div>
                          <div className="p-1">
                            <span className="text-[8px] font-black text-gray-400 uppercase block">Expenses</span>
                            <span className="text-xs font-extrabold text-[#E4002B]">₹{rep.totalExpenses.toLocaleString()}</span>
                          </div>
                          <div className="p-1">
                            <span className="text-[8px] font-black text-gray-400 uppercase block">Waste</span>
                            <span className="text-xs font-extrabold text-orange-600">₹{rep.totalWaste.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1 justify-end">
                          <button
                            onClick={async () => {
                              try {
                                const db = await apiAdminFetchDb();
                                const updatedReports = db.daily_reports.map(r => {
                                  if (r.id === rep.id) return { ...r, status: 'Rejected' };
                                  return r;
                                });
                                await apiAdminPushDb({ daily_reports: updatedReports });
                                setDailyReports(updatedReports);
                                alert("Daily report rejected.");
                              } catch (err) {
                                alert("Failed to reject report: " + err.message);
                              }
                            }}
                            className="px-4 py-1.5 border border-red-200 text-[#E4002B] hover:bg-red-50 text-[10px] font-black uppercase rounded-full transition-colors"
                          >
                            Reject ✕
                          </button>
                          <button
                            onClick={() => handleApproveReport(rep.id)}
                            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-full transition-colors"
                          >
                            Verify & Approve ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </section>
        )}
      </main>
    </div>
  );
}
