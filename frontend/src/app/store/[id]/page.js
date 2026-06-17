'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { INITIAL_STORES } from '../../store-data';
import { 
  syncWithServer, 
  pushToServer, 
  apiLogin, 
  apiUpdateOrderStatus, 
  getToken, 
  clearToken,
  apiFetchStoreOps,
  apiPostStoreOp
} from '../../db-sync';

export default function StoreDashboard() {
  const params = useParams();
  const router = useRouter();
  const storeId = params?.id;

  const [stores, setStores] = useState([]);
  const [store, setStore] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  // Auth states
  const [currentUser, setCurrentUser] = useState(null);
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'expenses', 'staff', 'waste', 'stock', 'reports'

  // Store Operations data states
  const [expenses, setExpenses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [wasteLog, setWasteLog] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [staffRota, setStaffRota] = useState([]);
  const [stockOrders, setStockOrders] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);

  // Expense form states
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Food Ingredients');
  const [expDesc, setExpDesc] = useState('');
  const [expError, setExpError] = useState('');

  // Staff timing / Clock states
  const [clockStaffId, setClockStaffId] = useState('');
  const [clockError, setClockError] = useState('');

  // Staff & Rota editor states
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [staffNameInput, setStaffNameInput] = useState('');
  const [staffRoleInput, setStaffRoleInput] = useState('Cashier');
  const [staffRateInput, setStaffRateInput] = useState('15');
  const [staffPhoneInput, setStaffPhoneInput] = useState('');
  const [staffSchedule, setStaffSchedule] = useState({
    Mon: '09:00 - 17:00', Tue: '09:00 - 17:00', Wed: '09:00 - 17:00',
    Thu: '09:00 - 17:00', Fri: '09:00 - 17:00', Sat: 'OFF', Sun: 'OFF'
  });
  const [staffError, setStaffError] = useState('');

  // Waste log states
  const [wasteItem, setWasteItem] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('Burnt/Dropped');
  const [wasteCost, setWasteCost] = useState('');
  const [wasteError, setWasteError] = useState('');

  // Stock adjustments
  const [adjustingItemId, setAdjustingItemId] = useState(null);
  const [adjustQtyVal, setAdjustQtyVal] = useState('');
  const [stockError, setStockError] = useState('');

  // Daily report submission status
  const [reportSuccess, setReportSuccess] = useState('');

  // Load initial data & sync with server
  useEffect(() => {
    if (!storeId) return;

    const init = async () => {
      await syncWithServer();

      // Load Stores
      let currentStores = INITIAL_STORES;
      const savedStores = localStorage.getItem('ccc_stores');
      if (savedStores) {
        currentStores = JSON.parse(savedStores);
      } else {
        localStorage.setItem('ccc_stores', JSON.stringify(INITIAL_STORES));
      }
      setStores(currentStores);

      const currentStore = currentStores.find(s => s.id === storeId);
      if (currentStore) {
        setStore(currentStore);
      } else {
        router.push('/');
      }

      // Load Active Orders
      const savedActive = localStorage.getItem('ccc_active_orders');
      if (savedActive) {
        const parsedActive = JSON.parse(savedActive);
        setActiveOrders(parsedActive.filter(o => o.storeId === storeId));
      }

      // Load Completed Orders
      const savedCompleted = localStorage.getItem('ccc_completed_orders');
      if (savedCompleted) {
        const parsedCompleted = JSON.parse(savedCompleted);
        setCompletedOrders(parsedCompleted.filter(o => o.storeId === storeId));
      }

      // Load User
      const savedUser = localStorage.getItem('ccc_current_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    };

    init();
  }, [storeId]);

  // Poll local storage & sync server for real-time order updates
  useEffect(() => {
    if (!storeId) return;

    const pollStorage = async () => {
      await syncWithServer();

      const savedStores = localStorage.getItem('ccc_stores');
      if (savedStores) {
        const parsedStores = JSON.parse(savedStores);
        setStores(parsedStores);
        const updatedStore = parsedStores.find(s => s.id === storeId);
        if (updatedStore) setStore(updatedStore);
      }

      const active = localStorage.getItem('ccc_active_orders');
      if (active) {
        const parsedActive = JSON.parse(active);
        setActiveOrders(parsedActive.filter(o => o.storeId === storeId));
      }

      const completed = localStorage.getItem('ccc_completed_orders');
      if (completed) {
        const parsedCompleted = JSON.parse(completed);
        setCompletedOrders(parsedCompleted.filter(o => o.storeId === storeId));
      }

      const savedUser = localStorage.getItem('ccc_current_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (!currentUser || currentUser.email !== parsed.email) {
          setCurrentUser(parsed);
        }
      } else if (currentUser) {
        setCurrentUser(null);
      }
    };

    const interval = setInterval(pollStorage, 3000);
    return () => clearInterval(interval);
  }, [storeId, currentUser]);

  // Fetch Operations Data
  useEffect(() => {
    if (!storeId || !currentUser) return;

    const isAuthorized = currentUser && (
      currentUser.role === 'admin' || 
      (currentUser.role === 'store_manager' && currentUser.storeId === storeId)
    );
    if (!isAuthorized) return;

    const fetchOps = async () => {
      try {
        const data = await apiFetchStoreOps(storeId);
        setExpenses(data.expenses || []);
        setShifts(data.shifts || []);
        setWasteLog(data.waste_log || []);
        setStockItems(data.stock_items || []);
        setStaffRota(data.staff_rota || []);
        setStockOrders(data.stock_orders || []);
        setDailyReports(data.daily_reports || []);
      } catch (err) {
        console.warn("Failed fetching store operations:", err.message);
      }
    };

    fetchOps();
    const interval = setInterval(fetchOps, 4000);
    return () => clearInterval(interval);
  }, [storeId, currentUser]);

  const handleStoreLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!storeEmail || !storePassword) {
      setAuthError('Email and Password are required.');
      return;
    }
    try {
      const data = await apiLogin(storeEmail, storePassword);
      const user = data.user;

      if (user.role !== 'admin' && (user.role !== 'store_manager' || user.storeId !== storeId)) {
        clearToken();
        setAuthError('Access denied. You do not manage this store.');
        return;
      }

      localStorage.setItem('ccc_current_user', JSON.stringify(user));
      setCurrentUser(user);
      setStoreEmail('');
      setStorePassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleStoreLogout = () => {
    localStorage.removeItem('ccc_current_user');
    clearToken();
    setCurrentUser(null);
  };

  // Sync actions
  const saveStoresToStorage = (updatedStores) => {
    localStorage.setItem('ccc_stores', JSON.stringify(updatedStores));
    setStores(updatedStores);
    const currentStore = updatedStores.find(s => s.id === storeId);
    if (currentStore) setStore(currentStore);
    pushToServer({ stores: updatedStores });
  };

  // Toggle open/closed status
  const handleToggleStatus = () => {
    if (!store) return;
    const updatedStores = stores.map(s => {
      if (s.id === store.id) {
        return { ...s, status: s.status === 'Open' ? 'Closed' : 'Open' };
      }
      return s;
    });
    saveStoresToStorage(updatedStores);
  };

  // Order progression via authenticated API
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const result = await apiUpdateOrderStatus(orderId, newStatus);
      
      if (result.active_orders) {
        localStorage.setItem('ccc_active_orders', JSON.stringify(result.active_orders));
        setActiveOrders(result.active_orders.filter(o => o.storeId === storeId));
      }
      if (result.completed_orders) {
        localStorage.setItem('ccc_completed_orders', JSON.stringify(result.completed_orders));
        setCompletedOrders(result.completed_orders.filter(o => o.storeId === storeId));
      }

      // If completed, update store revenue locally
      if (newStatus === 'Completed') {
        const savedActiveStr = localStorage.getItem('ccc_active_orders') || '[]';
        const allActiveOrders = JSON.parse(savedActiveStr);
        const orderToUpdate = allActiveOrders.find(o => o.id === orderId) || 
          (result.completed_orders || []).find(o => o.id === orderId);
        if (orderToUpdate) {
          const updatedStores = stores.map(s => {
            if (s.id === storeId) {
              return {
                ...s,
                historicalRevenue: (s.historicalRevenue || 0) + orderToUpdate.total,
                historicalOrders: (s.historicalOrders || 0) + 1
              };
            }
            return s;
          });
          localStorage.setItem('ccc_stores', JSON.stringify(updatedStores));
          setStores(updatedStores);
          const currentStore = updatedStores.find(s => s.id === storeId);
          if (currentStore) setStore(currentStore);
          pushToServer({ stores: updatedStores });
        }
      }
    } catch (err) {
      console.warn('API update failed, falling back to local:', err.message);
      // Fallback
    }
  };

  const cancelOrder = (orderId) => {
    const savedActiveStr = localStorage.getItem('ccc_active_orders') || '[]';
    const allActiveOrders = JSON.parse(savedActiveStr);
    const updatedActive = allActiveOrders.filter(o => o.id !== orderId);
    localStorage.setItem('ccc_active_orders', JSON.stringify(updatedActive));
    setActiveOrders(updatedActive.filter(o => o.storeId === storeId));
    pushToServer({ active_orders: updatedActive });
  };

  // Operations handlers
  const handleLogExpense = async (e) => {
    e.preventDefault();
    setExpError('');
    if (!expAmount || !expCategory) {
      setExpError('Amount and Category are required.');
      return;
    }
    try {
      const data = await apiPostStoreOp(storeId, 'log_expense', {
        amount: expAmount,
        category: expCategory,
        description: expDesc
      });
      setExpenses(data.expenses || []);
      setExpAmount('');
      setExpDesc('');
    } catch (err) {
      setExpError(err.message);
    }
  };

  const handleClockAction = async (action, staffName, shiftId = null) => {
    setClockError('');
    try {
      let data;
      if (action === 'clock_in') {
        data = await apiPostStoreOp(storeId, 'clock_in', { staffName });
      } else {
        data = await apiPostStoreOp(storeId, 'clock_out', { shiftId });
      }
      setShifts(data.shifts || []);
      setClockStaffId('');
    } catch (err) {
      setClockError(err.message);
    }
  };

  const handleSaveStaffRota = async (e) => {
    e.preventDefault();
    setStaffError('');
    if (!staffNameInput || !staffRoleInput) {
      setStaffError('Name and Role are required.');
      return;
    }
    try {
      const data = await apiPostStoreOp(storeId, 'update_staff_rota', {
        staffId: editingStaffId,
        name: staffNameInput,
        role: staffRoleInput,
        hourlyRate: staffRateInput,
        phone: staffPhoneInput,
        schedule: staffSchedule
      });
      setStaffRota(data.staff_rota || []);
      setEditingStaffId(null);
      setStaffNameInput('');
      setStaffRoleInput('Cashier');
      setStaffRateInput('15');
      setStaffPhoneInput('');
      setStaffSchedule({
        Mon: '09:00 - 17:00', Tue: '09:00 - 17:00', Wed: '09:00 - 17:00',
        Thu: '09:00 - 17:00', Fri: '09:00 - 17:00', Sat: 'OFF', Sun: 'OFF'
      });
    } catch (err) {
      setStaffError(err.message);
    }
  };

  const handleLogWaste = async (e) => {
    e.preventDefault();
    setWasteError('');
    if (!wasteItem || !wasteQty || !wasteCost) {
      setWasteError('All fields are required.');
      return;
    }
    try {
      const data = await apiPostStoreOp(storeId, 'log_waste', {
        itemName: wasteItem,
        quantity: wasteQty,
        reason: wasteReason,
        cost: wasteCost
      });
      setWasteLog(data.waste_log || []);
      setWasteItem('');
      setWasteQty('');
      setWasteCost('');
    } catch (err) {
      setWasteError(err.message);
    }
  };

  const handleUpdateStock = async (stockId, newQty) => {
    setStockError('');
    try {
      const data = await apiPostStoreOp(storeId, 'update_stock', {
        stockId,
        currentQty: newQty
      });
      setStockItems(data.stock_items || []);
      setAdjustingItemId(null);
    } catch (err) {
      setStockError(err.message);
    }
  };

  const handleRequestRestock = async () => {
    setStockError('');
    // Auto-gather items that are below alert level
    const lowStockItems = stockItems.filter(item => item.currentQty <= item.minQty);
    if (lowStockItems.length === 0) {
      alert("All inventory items are healthy! No restock needed.");
      return;
    }
    
    const itemsToOrder = lowStockItems.map(item => ({
      itemName: item.itemName,
      quantity: Math.ceil(item.minQty * 2 - item.currentQty),
      unit: item.unit
    }));

    try {
      const data = await apiPostStoreOp(storeId, 'send_stock_order', {
        items: itemsToOrder
      });
      setStockOrders(data.stock_orders || []);
      alert(`Restock order submitted to Admin for ${itemsToOrder.length} items!`);
    } catch (err) {
      setStockError(err.message);
    }
  };

  const handleSubmitDailyReport = async () => {
    setReportSuccess('');
    const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalW = wasteLog.reduce((sum, w) => sum + w.cost, 0);
    const activeShiftsCount = shifts.filter(s => s.clockOut === null).length;
    const stockAlertsCount = stockItems.filter(s => s.currentQty <= s.minQty).length;

    try {
      const data = await apiPostStoreOp(storeId, 'send_report', {
        totalSales,
        totalExpenses: totalExp,
        totalWaste: totalW,
        activeShiftsCount,
        stockAlertsCount
      });
      setDailyReports(data.daily_reports || []);
      setReportSuccess('Daily Report submitted successfully to Admin!');
      setTimeout(() => setReportSuccess(''), 5000);
    } catch (err) {
      alert("Failed to submit daily report: " + err.message);
    }
  };

  const startEditStaff = (staff) => {
    setEditingStaffId(staff.id);
    setStaffNameInput(staff.name);
    setStaffRoleInput(staff.role);
    setStaffRateInput(staff.hourlyRate.toString());
    setStaffPhoneInput(staff.phone || '');
    setStaffSchedule(staff.schedule || {
      Mon: 'OFF', Tue: 'OFF', Wed: 'OFF', Thu: 'OFF', Fri: 'OFF', Sat: 'OFF', Sun: 'OFF'
    });
  };

  if (!store) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F8F9FA] min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E4002B] mx-auto mb-4"></div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading Store Console...</span>
        </div>
      </div>
    );
  }

  const isOpen = store.status === 'Open';
  const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalCompletedCount = completedOrders.length;

  const isAuthorized = currentUser && (
    currentUser.role === 'admin' || 
    (currentUser.role === 'store_manager' && currentUser.storeId === storeId)
  );

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F8F9FA] min-h-screen font-sans antialiased text-black">
        <title>Store Login | Crispy Chicken Co.</title>
        <div className="h-1.5 bg-[#E4002B] absolute top-0 left-0 right-0"></div>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 border border-gray-200/50 flex flex-col gap-6 text-center animate-scale-in">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1 h-8 items-stretch justify-center">
              <div className="w-1.5 bg-[#E4002B]"></div>
              <div className="w-1.5 bg-[#E4002B]"></div>
              <div className="w-1.5 bg-[#E4002B]"></div>
            </div>
            <h1 className="text-xl font-black tracking-tight text-black mt-2 text-center">
              {store.name}
            </h1>
            <span className="bg-neutral-100 text-neutral-800 text-[9px] font-black border border-neutral-200 px-2 py-0.5 rounded uppercase tracking-widest mt-1">
              Store Operator Login
            </span>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg text-left">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleStoreLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Operator Email</label>
              <input
                type="email"
                required
                placeholder="manager@crispy.com"
                className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                value={storeEmail}
                onChange={(e) => setStoreEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                value={storePassword}
                onChange={(e) => setStorePassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-all tracking-wide shadow-sm font-bold mt-2"
            >
              Sign In to Store console 🔓
            </button>
          </form>

          <div className="flex justify-center items-center border-t border-gray-100 pt-4 text-[10px] font-bold text-gray-500">
            <Link href="/" className="text-[#E4002B] hover:underline font-extrabold">
              Back to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FA] text-black font-sans antialiased min-h-screen">
      <title>{store.name} Console | Crispy Chicken Co.</title>
      
      {/* Top red bar */}
      <div className="h-1.5 bg-[#E4002B] w-full"></div>

      {/* Header breadcrumb & info */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-black text-black tracking-tight">{store.name}</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase ${
                isOpen 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-red-50 border-red-200 text-[#E4002B]'
              }`}>
                {store.status}
              </span>
            </div>
            <span className="text-xs text-gray-400 font-bold mt-0.5">
              {store.address} | Manager: <span className="font-extrabold text-black">{store.manager}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-gray-700 hidden sm:inline">User: {currentUser.name}</span>
            <button
              onClick={handleStoreLogout}
              className="px-3.5 py-1.5 border border-gray-300 hover:border-red-600 text-gray-600 hover:text-[#E4002B] font-extrabold text-xs uppercase rounded-full bg-white transition-colors"
            >
              Lock Console 🔒
            </button>
            <button
              onClick={handleToggleStatus}
              className={`px-5 py-1.5 rounded-full text-xs font-black uppercase transition-colors tracking-wide border ${
                isOpen 
                  ? 'border-red-300 text-[#E4002B] bg-white hover:bg-red-50' 
                  : 'border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50'
              }`}
            >
              {isOpen ? '🔴 Close Outlet' : '🟢 Open Outlet'}
            </button>
            <Link 
              href="/" 
              className="px-4 py-1.5 border border-gray-300 font-extrabold text-xs uppercase bg-white text-gray-700 hover:text-black hover:bg-gray-50 rounded-full transition-colors"
            >
              Exit Console
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="bg-white border-b border-gray-200/80 px-4 sm:px-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-6 text-xs font-black uppercase tracking-wider text-gray-500 py-1">
          {[
            { id: 'orders', label: '📦 Orders & Ledger' },
            { id: 'expenses', label: '💰 Expenses & profit' },
            { id: 'staff', label: '👥 Staff clock & rota' },
            { id: 'waste', label: '🗑️ Waste Management' },
            { id: 'stock', label: '🥔 Stock & inventory' },
            { id: 'reports', label: '📊 Daily reports' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 border-b-2 px-1 transition-all ${
                activeTab === tab.id 
                  ? 'border-[#E4002B] text-black font-extrabold' 
                  : 'border-transparent hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 sm:px-8 flex-1">
        
        {/* ==================== TAB 1: ORDERS ==================== */}
        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div>
                  <h2 className="text-sm font-black uppercase text-black">Active Incoming Orders Queue ({activeOrders.length})</h2>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">Process and update status of orders placed for this outlet.</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Live Queue
                </span>
              </div>

              {activeOrders.length === 0 ? (
                <div className="bg-white border border-gray-200 p-12 text-center rounded-xl flex flex-col items-center justify-center shadow-sm">
                  <span className="text-4xl mb-3 select-none">📭</span>
                  <h3 className="text-base font-black text-black">No pending orders</h3>
                  <p className="text-xs text-gray-500 font-bold mt-1">Orders placed by customers for this location will appear here in real time.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeOrders.map(order => (
                    <div key={order.id} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:border-gray-300 transition-colors">
                      <div>
                        <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
                          <div>
                            <h4 className="text-base font-black text-black">{order.id}</h4>
                            <span className="text-[10px] text-gray-400 font-bold block mt-0.5">Placed: {new Date(order.timestamp).toLocaleTimeString()}</span>
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

                        <div className="space-y-3 mb-6">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Order Items</span>
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
                              Customer: <span className="text-black font-extrabold">{order.customerName}</span> | Payment: <span className="text-black font-extrabold">{order.paymentMethod}</span>
                            </div>
                            <div className="text-base font-black text-black">
                              Total Value: <span className="text-[#E4002B] font-extrabold">₹{order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-4 mt-auto flex justify-between items-center">
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
                              Mark Completed
                            </button>
                          )}
                        </div>
                        
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="px-3 py-1.5 text-gray-400 hover:text-red-600 font-extrabold text-[10px] uppercase transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3.5 tracking-wider">
                  Outlet Daily Sales Summary
                </h2>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider">Total Sales</span>
                    <span className="text-lg font-black text-[#E4002B] block mt-1">
                      ₹{totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider">Completed Orders</span>
                    <span className="text-lg font-black text-black block mt-1">
                      {totalCompletedCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3.5 mb-4 tracking-wider">
                  Completed Sales Journal ({completedOrders.length})
                </h2>

                {completedOrders.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs font-bold">
                    No completed transactions.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[10px]">
                      <thead>
                        <tr className="bg-neutral-50 text-gray-400 border-b border-gray-200 uppercase font-black">
                          <th className="p-2">Order ID</th>
                          <th className="p-2 text-right">Items</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-bold text-gray-600">
                        {completedOrders.map((order, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="p-2 text-black font-extrabold">{order.id}</td>
                            <td className="p-2 text-right">{order.items.reduce((sum, i) => sum + i.quantity, 0)} items</td>
                            <td className="p-2 text-right text-black font-extrabold">₹{order.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: FINANCIALS & EXPENSES ==================== */}
        {activeTab === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Financial Summary Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Gross Sales</span>
                  <span className="text-xl font-black text-emerald-600 block mt-1">₹{totalSales.toLocaleString()}</span>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Total Expenses</span>
                  <span className="text-xl font-black text-[#E4002B] block mt-1">
                    ₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Net Operating Profit</span>
                  <span className={`text-xl font-black block mt-1 ${
                    (totalSales - expenses.reduce((sum, e) => sum + e.amount, 0)) >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}>
                    ₹{(totalSales - expenses.reduce((sum, e) => sum + e.amount, 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Expense Ledger */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 mb-4 tracking-wider">
                  Expense Transaction Ledger
                </h3>
                {expenses.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-6 text-center">No expenses logged today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 font-black uppercase text-[10px]">
                          <th className="p-3">Date/Time</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">By</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                        {expenses.map(exp => (
                          <tr key={exp.id} className="hover:bg-neutral-50/50">
                            <td className="p-3 text-[10px] text-gray-400">{new Date(exp.timestamp).toLocaleString()}</td>
                            <td className="p-3">
                              <span className="bg-gray-100 text-gray-800 text-[9px] font-black px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wider">
                                {exp.category}
                              </span>
                            </td>
                            <td className="p-3 text-black font-extrabold">{exp.description || '—'}</td>
                            <td className="p-3 text-gray-500">{exp.recordedBy}</td>
                            <td className="p-3 text-right text-black font-extrabold">₹{exp.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Log Expense Form */}
            <div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3.5 tracking-wider">
                  💸 Record Store Expense
                </h3>
                {expError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg">
                    {expError}
                  </div>
                )}
                <form onSubmit={handleLogExpense} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Expense Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 2500"
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Expense Category</label>
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                    >
                      <option>Food Ingredients</option>
                      <option>Wages & Staffing</option>
                      <option>Utilities & Bills</option>
                      <option>Equipment Repair</option>
                      <option>Marketing / Promo</option>
                      <option>Store Rent Contribution</option>
                      <option>Other Operational Costs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Expense Description</label>
                    <textarea
                      placeholder="e.g. Emergency grease trap repair service"
                      rows="3"
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={expDesc}
                      onChange={(e) => setExpDesc(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm tracking-wide"
                  >
                    Post Expense Entry 💸
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: STAFF & ROTA ==================== */}
        {activeTab === 'staff' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Clock In / Clock Out Shift Tracker */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 mb-4 tracking-wider flex justify-between items-center">
                  <span>⏱️ Active Shifts Console</span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 animate-pulse">
                    Live Timing
                  </span>
                </h3>

                {clockError && (
                  <div className="p-3 mb-4 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg">
                    {clockError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-6">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Select Shift Operator</label>
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={clockStaffId}
                      onChange={(e) => setClockStaffId(e.target.value)}
                    >
                      <option value="">-- Choose Staff Member --</option>
                      {staffRota.map(staff => (
                        <option key={staff.id} value={staff.name}>{staff.name} ({staff.role})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => handleClockAction('clock_in', clockStaffId)}
                    disabled={!clockStaffId}
                    className="py-2 bg-black hover:bg-neutral-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-black uppercase rounded-full transition-colors tracking-wide h-10"
                  >
                    Punch Clock In 🟢
                  </button>
                </div>

                {/* Shift Registry */}
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2.5">Today's Shift Log</h4>
                {shifts.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-4 text-center">No shifts recorded today.</p>
                ) : (
                  <div className="space-y-3">
                    {shifts.map(shift => {
                      const isClockedIn = !shift.clockOut;
                      const durationMin = shift.clockOut 
                        ? Math.floor((new Date(shift.clockOut) - new Date(shift.clockIn)) / 60000)
                        : null;
                      const formattedDuration = durationMin !== null 
                        ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                        : 'Active Shift';

                      return (
                        <div key={shift.id} className="flex justify-between items-center p-3.5 bg-neutral-50 rounded-xl border border-gray-200/50 hover:border-gray-200">
                          <div>
                            <span className="text-xs font-black text-black block">{shift.staffName}</span>
                            <span className="text-[10px] text-gray-400 font-bold mt-0.5">
                              In: {new Date(shift.clockIn).toLocaleTimeString()} 
                              {shift.clockOut && ` | Out: ${new Date(shift.clockOut).toLocaleTimeString()}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                              isClockedIn 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-gray-100 border-gray-200 text-gray-600'
                            }`}>
                              {formattedDuration}
                            </span>
                            {isClockedIn && (
                              <button
                                onClick={() => handleClockAction('clock_out', null, shift.id)}
                                className="px-3 py-1 bg-[#E4002B] hover:bg-[#C30022] text-white text-[9px] font-black uppercase rounded-full transition-colors"
                              >
                                Clock Out 🔴
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rota Schedule Grid */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 mb-4 tracking-wider">
                  📅 Staff Rota & Weekly Shift schedule
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 font-black border-b border-gray-200 uppercase text-[9px]">
                        <th className="p-3">Staff Name</th>
                        <th className="p-3">Role</th>
                        <th className="p-3 text-center">Mon</th>
                        <th className="p-3 text-center">Tue</th>
                        <th className="p-3 text-center">Wed</th>
                        <th className="p-3 text-center">Thu</th>
                        <th className="p-3 text-center">Fri</th>
                        <th className="p-3 text-center">Sat</th>
                        <th className="p-3 text-center">Sun</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                      {staffRota.map(staff => (
                        <tr key={staff.id} className="hover:bg-neutral-50/50">
                          <td className="p-3 text-black font-extrabold">
                            <div>
                              <span>{staff.name}</span>
                              <span className="text-[10px] text-gray-400 block font-normal mt-0.5">{staff.phone} | ₹{staff.hourlyRate}/hr</span>
                            </div>
                          </td>
                          <td className="p-3">{staff.role}</td>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                            const sched = staff.schedule?.[day] || 'OFF';
                            const isOff = sched === 'OFF';
                            return (
                              <td key={day} className="p-3 text-center">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                  isOff ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-[#E4002B] border border-red-100'
                                }`}>
                                  {isOff ? 'OFF' : sched.replace(' - ', '-')}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-3 text-right">
                            <button
                              onClick={() => startEditStaff(staff)}
                              className="text-blue-600 hover:text-blue-800 text-[10px] uppercase font-black"
                            >
                              Edit ✏️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Rota Manager Form */}
            <div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3.5 tracking-wider">
                  {editingStaffId ? '✏️ Edit Staff / Rota Details' : '👤 Add New Staff Member'}
                </h3>
                {staffError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg">
                    {staffError}
                  </div>
                )}
                <form onSubmit={handleSaveStaffRota} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Staff Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Liam Smith"
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={staffNameInput}
                      onChange={(e) => setStaffNameInput(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Role</label>
                      <select
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                        value={staffRoleInput}
                        onChange={(e) => setStaffRoleInput(e.target.value)}
                      >
                        <option>Cashier</option>
                        <option>Head Fryer</option>
                        <option>Prep Cook</option>
                        <option>Delivery Rider</option>
                        <option>Cleaner</option>
                        <option>Supervisor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Wage Rate (₹/hr)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                        value={staffRateInput}
                        onChange={(e) => setStaffRateInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={staffPhoneInput}
                      onChange={(e) => setStaffPhoneInput(e.target.value)}
                    />
                  </div>

                  {/* Daily Rota Schedules */}
                  <div className="border-t border-gray-100 pt-3">
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-2">Weekly Rota Shifts</label>
                    <div className="space-y-2 h-44 overflow-y-auto pr-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="flex justify-between items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-gray-500 w-8">{day}</span>
                          <select
                            className="bg-white border border-gray-200 rounded-lg py-1 px-2 text-[10px] text-black font-bold focus:outline-none focus:border-[#E4002B] flex-1"
                            value={staffSchedule[day]}
                            onChange={(e) => setStaffSchedule({ ...staffSchedule, [day]: e.target.value })}
                          >
                            <option value="OFF">OFF / Rota Day</option>
                            <option value="09:00 - 17:00">Morning (09:00 - 17:00)</option>
                            <option value="17:00 - 01:00">Evening (17:00 - 01:00)</option>
                            <option value="12:00 - 20:00">Mid-Day (12:00 - 20:00)</option>
                            <option value="09:00 - 01:00">Double Shift (09:00 - 01:00)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm tracking-wide"
                    >
                      Save Staff details 👥
                    </button>
                    {editingStaffId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaffId(null);
                          setStaffNameInput('');
                          setStaffPhoneInput('');
                          setStaffRateInput('15');
                          setStaffSchedule({
                            Mon: 'OFF', Tue: 'OFF', Wed: 'OFF', Thu: 'OFF', Fri: 'OFF', Sat: 'OFF', Sun: 'OFF'
                          });
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-full text-xs font-black uppercase hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: WASTE ==================== */}
        {activeTab === 'waste' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Total Food Waste Lost Cost</span>
                <span className="text-2xl font-black text-[#E4002B] block mt-1">
                  ₹{wasteLog.reduce((sum, w) => sum + w.cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Keep food wastage low to protect operating margins.</p>
              </div>

              {/* Waste Ledger */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 mb-4 tracking-wider">
                  Food Wastage Log Ledger
                </h3>
                {wasteLog.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-6 text-center">No wastage items logged today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 font-black uppercase text-[10px]">
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Wasted Item</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3 text-right">Lost Value Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                        {wasteLog.map(w => (
                          <tr key={w.id} className="hover:bg-neutral-50/50">
                            <td className="p-3 text-[10px] text-gray-400">{new Date(w.timestamp).toLocaleString()}</td>
                            <td className="p-3 text-black font-extrabold">{w.itemName}</td>
                            <td className="p-3 text-center text-gray-800">{w.quantity}</td>
                            <td className="p-3">
                              <span className="bg-red-50 text-[#E4002B] text-[8px] font-black border border-red-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                {w.reason}
                              </span>
                            </td>
                            <td className="p-3 text-right text-black font-extrabold">₹{w.cost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Waste Logger Form */}
            <div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3.5 tracking-wider">
                  🗑️ Log Food Wastage
                </h3>
                {wasteError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg">
                    {wasteError}
                  </div>
                )}
                <form onSubmit={handleLogWaste} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Wasted Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10 Pcs Crispy Chicken Bucket"
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={wasteItem}
                      onChange={(e) => setWasteItem(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Quantity</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 2"
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                        value={wasteQty}
                        onChange={(e) => setWasteQty(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Cost Value (₹)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 1798"
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                        value={wasteCost}
                        onChange={(e) => setWasteCost(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Wastage Reason</label>
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none focus:border-[#E4002B]"
                      value={wasteReason}
                      onChange={(e) => setWasteReason(e.target.value)}
                    >
                      <option>Burnt/Dropped</option>
                      <option>Expired Stock</option>
                      <option>Kitchen Prep Error</option>
                      <option>Customer Return</option>
                      <option>Other / Spoilage</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm tracking-wide"
                  >
                    Post Wastage Entry 🗑️
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: STOCK ==================== */}
        {activeTab === 'stock' && (
          <div className="space-y-6">
            
            {/* Stock Actions Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl border border-gray-200 shadow-sm gap-4">
              <div>
                <h2 className="text-sm font-black uppercase text-black">🥔 Local Store Inventory stock</h2>
                <p className="text-xs text-gray-500 font-bold mt-0.5">Track ingredient stock levels and request replenishment order from Admin.</p>
              </div>
              <button
                onClick={handleRequestRestock}
                className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase rounded-full transition-colors tracking-wide shadow-sm"
              >
                🚨 Order Run Out Stock (Send to Admin)
              </button>
            </div>

            {stockError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg">
                {stockError}
              </div>
            )}

            {/* Inventory table */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 font-black uppercase text-[10px]">
                      <th className="p-3">Item Name</th>
                      <th className="p-3">Current Inventory</th>
                      <th className="p-3">Min Alert Level</th>
                      <th className="p-3">Status Alert</th>
                      <th className="p-3 text-right">Count Adjustments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                    {stockItems.map(item => {
                      const isLow = item.currentQty <= item.minQty;
                      const isOut = item.currentQty === 0;

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/50">
                          <td className="p-3 text-black font-extrabold">{item.itemName}</td>
                          <td className="p-3">
                            <span className="text-sm font-black text-black">{item.currentQty}</span>
                            <span className="text-gray-400 text-[10px] font-normal ml-1">({item.unit})</span>
                          </td>
                          <td className="p-3 text-gray-500">{item.minQty} {item.unit}</td>
                          <td className="p-3">
                            {isOut ? (
                              <span className="bg-red-100 text-[#E4002B] text-[8px] font-black border border-red-200 px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                RUN OUT 🚨
                              </span>
                            ) : isLow ? (
                              <span className="bg-amber-50 text-amber-700 text-[8px] font-black border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider">
                                LOW STOCK ⚠️
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 text-[8px] font-black border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-wider">
                                HEALTHY STOCK ✓
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {adjustingItemId === item.id ? (
                              <div className="flex gap-1.5 justify-end">
                                <input
                                  type="number"
                                  className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-black font-bold"
                                  value={adjustQtyVal}
                                  placeholder={item.currentQty.toString()}
                                  onChange={(e) => setAdjustQtyVal(e.target.value)}
                                />
                                <button
                                  onClick={() => handleUpdateStock(item.id, adjustQtyVal)}
                                  className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded uppercase"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setAdjustingItemId(null)}
                                  className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[9px] font-black rounded uppercase"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAdjustingItemId(item.id);
                                  setAdjustQtyVal(item.currentQty.toString());
                                }}
                                className="text-blue-600 hover:text-blue-800 text-[10px] uppercase font-black"
                              >
                                Adjust Level ✏️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Replenishment Ledger */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 mb-4 tracking-wider">
                Submitted Restock Orders Ledger
              </h3>
              {stockOrders.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold py-4 text-center">No restock requests submitted.</p>
              ) : (
                <div className="space-y-4">
                  {stockOrders.map(order => (
                    <div key={order.id} className="p-4 bg-neutral-50 rounded-xl border border-gray-200/50">
                      <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-2">
                        <div>
                          <span className="text-xs font-black text-black">Order ID: {order.id}</span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">Submitted: {new Date(order.timestamp).toLocaleString()} by {order.requestedBy}</span>
                        </div>
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                          order.status === 'Approved' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item, idx) => (
                          <span key={idx} className="bg-white border border-gray-200 px-2 py-1 rounded text-[10px] font-bold text-gray-700">
                            {item.itemName} <span className="font-extrabold text-black">+{item.quantity} {item.unit}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 6: REPORTS ==================== */}
        {activeTab === 'reports' && (
          <div className="max-w-2xl mx-auto space-y-6">
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
              <div className="text-center">
                <span className="text-3xl select-none">📊</span>
                <h2 className="text-base font-black uppercase text-black mt-2">End-Of-Day Daily Report Console</h2>
                <p className="text-xs text-gray-500 font-bold mt-1">Compile store financial performance, waste stats, shifts, and stock warnings, then send report to the admin.</p>
              </div>

              {reportSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 rounded-lg text-center">
                  ✓ {reportSuccess}
                </div>
              )}

              {/* Autogenerated Summary values */}
              <div className="border-t border-b border-gray-100 py-5 space-y-3.5">
                <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                  <span>Gross Sales Total:</span>
                  <span className="text-black font-extrabold">₹{totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                  <span>Total Recorded Expenses:</span>
                  <span className="text-[#E4002B] font-extrabold">-₹{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                  <span>Food Waste Cost:</span>
                  <span className="text-[#E4002B] font-extrabold">-₹{wasteLog.reduce((sum, w) => sum + w.cost, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-600 border-t border-dashed border-gray-200 pt-3">
                  <span className="font-extrabold text-black">Net Operating Profit:</span>
                  <span className={`text-sm font-black ${
                    (totalSales - expenses.reduce((sum, e) => sum + e.amount, 0) - wasteLog.reduce((sum, w) => sum + w.cost, 0)) >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}>
                    ₹{(totalSales - expenses.reduce((sum, e) => sum + e.amount, 0) - wasteLog.reduce((sum, w) => sum + w.cost, 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                  <span>Staff Timing Shifts Logged:</span>
                  <span className="text-black font-extrabold">{shifts.length} Shifts ({shifts.filter(s => s.clockOut === null).length} active)</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                  <span>Low Inventory Warnings:</span>
                  <span className="text-black font-extrabold">{stockItems.filter(s => s.currentQty <= s.minQty).length} items low</span>
                </div>
              </div>

              <button
                onClick={handleSubmitDailyReport}
                className="w-full py-3 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm tracking-wide"
              >
                Compile and Submit Daily Report to Admin 📊
              </button>
            </div>

            {/* Reports list */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase text-black border-b border-gray-100 pb-3 mb-4 tracking-wider">
                Submitted Daily Reports Ledger
              </h3>
              {dailyReports.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold py-4 text-center">No reports submitted yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {dailyReports.map(rep => (
                    <div key={rep.id} className="flex justify-between items-center p-3.5 bg-neutral-50 rounded-xl border border-gray-200/50">
                      <div>
                        <span className="text-xs font-black text-black block">Report Date: {rep.date}</span>
                        <span className="text-[10px] text-gray-400 font-bold mt-0.5">
                          Submitted: {new Date(rep.submittedAt).toLocaleTimeString()} | Sales: ₹{rep.totalSales.toLocaleString()} | Exp: ₹{rep.totalExpenses.toLocaleString()}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                        rep.status === 'Approved' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                          : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                      }`}>
                        {rep.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
