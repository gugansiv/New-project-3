'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { INITIAL_STORES } from '../../store-data';
import { syncWithServer, pushToServer, apiLogin, apiUpdateOrderStatus, getToken, clearToken } from '../../db-sync';

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

  // Poll local storage & sync server for real-time updates
  useEffect(() => {
    if (!storeId) return;

    const pollStorage = async () => {
      await syncWithServer();

      const savedStores = localStorage.getItem('ccc_stores');
      if (savedStores) {
        const parsedStores = JSON.parse(savedStores);
        setStores(parsedStores);
        const updatedStore = parsedStores.find(s => s.id === storeId);
        if (updatedStore) {
          setStore(updatedStore);
        }
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

      // A Store Manager must be assigned to THIS store or be an Admin
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
      
      // Update local state from server response
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
      // Fallback to local-only update
      console.warn('API update failed, falling back to local:', err.message);
      const savedActiveStr = localStorage.getItem('ccc_active_orders') || '[]';
      const allActiveOrders = JSON.parse(savedActiveStr);
      const orderToUpdate = allActiveOrders.find(o => o.id === orderId);
      if (!orderToUpdate) return;

      if (newStatus === 'Completed') {
        const updatedActive = allActiveOrders.filter(o => o.id !== orderId);
        localStorage.setItem('ccc_active_orders', JSON.stringify(updatedActive));
        setActiveOrders(updatedActive.filter(o => o.storeId === storeId));
        const savedCompletedStr = localStorage.getItem('ccc_completed_orders') || '[]';
        const allCompletedOrders = JSON.parse(savedCompletedStr);
        const updatedCompleted = [{ ...orderToUpdate, status: 'Completed' }, ...allCompletedOrders];
        localStorage.setItem('ccc_completed_orders', JSON.stringify(updatedCompleted));
        setCompletedOrders(updatedCompleted.filter(o => o.storeId === storeId));
        pushToServer({ active_orders: updatedActive, completed_orders: updatedCompleted });
      } else {
        const updatedActive = allActiveOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
        localStorage.setItem('ccc_active_orders', JSON.stringify(updatedActive));
        setActiveOrders(updatedActive.filter(o => o.storeId === storeId));
        pushToServer({ active_orders: updatedActive });
      }
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
  const totalSales = store.historicalRevenue || 0;
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
            <span className="text-xs text-gray-400 font-bold mt-0.5">{store.address} | Manager: <span className="font-extrabold text-black">{store.manager}</span></span>
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

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 sm:px-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Main Active Orders Processing - span 2) */}
        <section className="lg:col-span-2 space-y-6">
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
                    {/* Header */}
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

                    {/* Items List */}
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

                  {/* Processing Actions */}
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
        </section>

        {/* Right Column (Local Store Metrics & Completed Sales Ledger) */}
        <section className="space-y-6">
          {/* Quick Metrics */}
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
            
            {/* Sales vs Target progress bar */}
            {store.dailyTarget > 0 && (
              <div className="pt-2 border-t border-gray-50">
                <div className="flex justify-between items-center text-[9px] font-extrabold text-gray-400 uppercase mb-1.5">
                  <span>Sales Target Progress</span>
                  <span className="text-black font-extrabold">₹{store.dailyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} Target</span>
                </div>
                <div className="h-2 w-full bg-gray-100 border border-gray-200/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.min((totalSales / store.dailyTarget) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] font-black text-emerald-600 mt-1 block">
                  {((totalSales / store.dailyTarget) * 100).toFixed(1)}% of target met
                </span>
              </div>
            )}
          </div>

          {/* Local completed log */}
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
        </section>
      </main>
    </div>
  );
}
