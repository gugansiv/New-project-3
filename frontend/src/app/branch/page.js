'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BranchPortal() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('orders'); // orders, pos, stock, shifts
  const [activeOrders, setActiveOrders] = useState([]);
  
  const [menuItems, setMenuItems] = useState([]);
  const [opsData, setOpsData] = useState(null);
  const [posCart, setPosCart] = useState([]);
  const [posCustomer, setPosCustomer] = useState('Walk-In');
  const [posProcessing, setPosProcessing] = useState(false);
  const [staffName, setStaffName] = useState('');

  // Basic Auth Check
  useEffect(() => {
    const userLocal = localStorage.getItem('ccc_current_user');
    if (!userLocal) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userLocal);
    if (user.role !== 'BRANCH_MANAGER' && user.role !== 'SUPER_ADMIN' && user.role !== 'REGIONAL_MANAGER') {
      alert('Access Denied. Branch Manager access required.');
      router.push('/');
      return;
    }
    setCurrentUser(user);
    fetchAllData(user.storeId);
  }, []);

  const fetchAllData = async (storeId) => {
    const token = localStorage.getItem('ccc_auth_token');
    
    // Fetch active orders
    try {
      const oRes = await fetch(`/api/orders?type=active&storeId=${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (oRes.ok) setActiveOrders((await oRes.json()).active_orders || []);
    } catch (e) {}

    // Fetch menu
    try {
      const mRes = await fetch('/api/menu');
      if (mRes.ok) setMenuItems(await mRes.json());
    } catch (e) {}

    // Fetch ops data
    fetchOpsData(storeId, token);
  };

  const fetchOpsData = async (storeId, token) => {
    try {
      if (!token) token = localStorage.getItem('ccc_auth_token');
      const opsRes = await fetch(`/api/store/ops?storeId=${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (opsRes.ok) setOpsData(await opsRes.json());
    } catch (e) {}
  };

  const markOrderComplete = async (orderId) => {
    try {
      const token = localStorage.getItem('ccc_auth_token');
      await fetch(`/api/admin/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchAllData(currentUser.storeId);
    } catch (err) {
      console.error(err);
    }
  };

  // --- POS Logic ---
  const addToPosCart = (item) => {
    const existing = posCart.find(i => i.id === item.id);
    if (existing) {
      setPosCart(posCart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setPosCart([...posCart, { ...item, quantity: 1 }]);
    }
  };
  
  const posSubtotal = posCart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const posTotal = posSubtotal + posSubtotal * 0.08;

  const handlePosCheckout = async () => {
    if (posCart.length === 0) return;
    setPosProcessing(true);
    const token = localStorage.getItem('ccc_auth_token');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          id: `ord-${Math.floor(1000 + Math.random() * 9000)}`,
          storeId: currentUser.storeId,
          storeName: 'Branch Store',
          items: posCart,
          paymentMethod: 'Cash/Card',
          customerName: posCustomer,
          collectionTime: 'Now'
        })
      });
      
      const data = await res.json();
      if (data.error) {
        alert('Error placing order: ' + data.error);
      } else {
        setPosCart([]);
        setPosCustomer('Walk-In');
        alert('Order Placed Successfully!');
        fetchAllData(currentUser.storeId);
        setActiveTab('orders');
      }
    } catch (e) {
      alert('Error placing order');
    }
    setPosProcessing(false);
  };

  // --- Ops Logic ---
  const sendOpsAction = async (action, data) => {
    const token = localStorage.getItem('ccc_auth_token');
    try {
      const res = await fetch('/api/store/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          storeId: currentUser.storeId,
          action,
          data
        })
      });
      const resData = await res.json();
      if (resData.error) alert(resData.error);
      else {
         alert('Success');
         fetchOpsData(currentUser.storeId, token);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) return <div className="p-10 text-center font-bold">Loading Branch Portal...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-black text-white p-6 hidden md:block shrink-0">
        <h1 className="text-2xl font-black mb-10 text-[#E4002B]">BRANCH HQ</h1>
        <div className="space-y-4">
          <button onClick={() => setActiveTab('orders')} className={`w-full text-left px-4 py-3 rounded-lg font-bold ${activeTab === 'orders' ? 'bg-[#E4002B]' : 'hover:bg-gray-800'}`}>Live Orders</button>
          <button onClick={() => setActiveTab('pos')} className={`w-full text-left px-4 py-3 rounded-lg font-bold ${activeTab === 'pos' ? 'bg-[#E4002B]' : 'hover:bg-gray-800'}`}>Counter POS</button>
          <button onClick={() => setActiveTab('stock')} className={`w-full text-left px-4 py-3 rounded-lg font-bold ${activeTab === 'stock' ? 'bg-[#E4002B]' : 'hover:bg-gray-800'}`}>Local Stock</button>
          <button onClick={() => setActiveTab('shifts')} className={`w-full text-left px-4 py-3 rounded-lg font-bold ${activeTab === 'shifts' ? 'bg-[#E4002B]' : 'hover:bg-gray-800'}`}>Time Tracking</button>
        </div>
        <div className="mt-auto pt-20">
          <p className="text-xs text-gray-400 font-bold mb-2">Logged in as {currentUser.name}</p>
          <button onClick={() => { localStorage.removeItem('ccc_current_user'); router.push('/'); }} className="text-xs font-bold text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 sm:p-10 h-screen overflow-y-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black text-black">Store Management</h2>
            <p className="text-gray-500 font-bold text-sm">Store ID: {currentUser.storeId}</p>
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xl font-black mb-6">Kitchen Queue ({activeOrders.length})</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeOrders.map(order => (
                <div key={order.id} className="border-2 border-orange-100 bg-orange-50/30 p-4 rounded-xl flex flex-col">
                  <div className="flex justify-between mb-3 border-b border-orange-100 pb-3">
                    <span className="font-black text-lg text-orange-900">#{order.id.slice(-4).toUpperCase()}</span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-md">{order.collectionTime}</span>
                  </div>
                  <div className="flex-1 space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 text-sm font-bold text-gray-800">
                        <span className="text-[#E4002B]">{item.quantity}x</span>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => markOrderComplete(order.id)} className="w-full bg-[#E4002B] hover:bg-[#C30022] text-white py-3 rounded-lg font-black text-sm uppercase tracking-wider">
                    Mark Ready
                  </button>
                </div>
              ))}
              {activeOrders.length === 0 && <p className="text-gray-400 font-bold">No active orders in the queue.</p>}
            </div>
          </div>
        )}

        {activeTab === 'pos' && (
           <div className="flex gap-6 h-[calc(100vh-140px)]">
             <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6 overflow-y-auto">
               <h3 className="text-xl font-black mb-6">Menu Items</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {menuItems.map(item => (
                   <button 
                     key={item.id} 
                     onClick={() => addToPosCart(item)}
                     className="border border-gray-200 rounded-xl p-4 flex flex-col items-center text-center hover:border-[#E4002B] hover:shadow-md transition-all active:scale-95"
                   >
                     <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-full mb-3" />
                     <span className="text-sm font-bold leading-tight">{item.name}</span>
                     <span className="text-[#E4002B] font-black mt-1">₹{item.price}</span>
                   </button>
                 ))}
               </div>
             </div>
             <div className="w-80 bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
               <h3 className="text-xl font-black mb-4">Current Order</h3>
               <div className="mb-4">
                  <input 
                    type="text" 
                    value={posCustomer} 
                    onChange={e => setPosCustomer(e.target.value)} 
                    placeholder="Customer Name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#E4002B]"
                  />
               </div>
               <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                 {posCart.map(item => (
                   <div key={item.id} className="flex justify-between items-center text-sm">
                     <div className="flex items-center gap-2">
                       <span className="bg-gray-100 text-gray-800 font-black px-2 py-0.5 rounded text-xs">{item.quantity}x</span>
                       <span className="font-bold truncate w-32">{item.name}</span>
                     </div>
                     <span className="font-bold text-gray-500">₹{item.price * item.quantity}</span>
                   </div>
                 ))}
                 {posCart.length === 0 && <p className="text-gray-400 text-sm text-center mt-10">Cart is empty.</p>}
               </div>
               <div className="border-t border-dashed border-gray-200 pt-4 mb-4">
                 <div className="flex justify-between font-bold text-gray-500 text-sm mb-1">
                   <span>Subtotal</span><span>₹{posSubtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between font-black text-xl mt-2">
                   <span>Total</span><span className="text-[#E4002B]">₹{posTotal.toFixed(2)}</span>
                 </div>
               </div>
               <button 
                 onClick={handlePosCheckout}
                 disabled={posCart.length === 0 || posProcessing}
                 className="w-full bg-[#E4002B] disabled:bg-gray-300 text-white font-black py-4 rounded-xl uppercase tracking-wider"
               >
                 {posProcessing ? 'Processing...' : 'Charge Cash/Card'}
               </button>
             </div>
           </div>
        )}

        {activeTab === 'stock' && (
           <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-black">Local Stock Inventory</h3>
               <button 
                 onClick={() => {
                   const promptItem = prompt("What item do you need to restock?");
                   if (promptItem) {
                     sendOpsAction('send_stock_order', { items: [{ itemName: promptItem, quantity: 10, unit: 'units' }] });
                   }
                 }}
                 className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800 text-sm"
               >
                 Request Restock
               </button>
             </div>
             
             {!opsData ? <p>Loading stock...</p> : (
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead>
                     <tr className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                       <th className="p-4 rounded-tl-lg">Item Name</th>
                       <th className="p-4">Current Qty</th>
                       <th className="p-4">Minimum Qty</th>
                       <th className="p-4 rounded-tr-lg">Action</th>
                     </tr>
                   </thead>
                   <tbody>
                     {opsData.stock_items.map(item => (
                       <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                         <td className="p-4 font-bold text-gray-800">{item.itemName}</td>
                         <td className="p-4">
                           <span className={`px-2 py-1 rounded text-xs font-black ${item.currentQty <= item.minQty ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                             {item.currentQty} {item.unit}
                           </span>
                         </td>
                         <td className="p-4 font-semibold text-gray-500">{item.minQty}</td>
                         <td className="p-4">
                           <button 
                             onClick={() => {
                               const newQty = prompt(`Enter new quantity for ${item.itemName} (currently ${item.currentQty}):`, item.currentQty);
                               if (newQty !== null && !isNaN(newQty)) {
                                 sendOpsAction('update_stock', { stockId: item.id, currentQty: newQty });
                               }
                             }}
                             className="text-[#E4002B] font-bold hover:underline"
                           >
                             Update count
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
        )}

        {activeTab === 'shifts' && (
           <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm max-w-2xl mx-auto mt-10">
             <h3 className="text-2xl font-black mb-2 text-center">Staff Time Tracking</h3>
             <p className="text-center text-gray-500 font-bold mb-8">Clock in and out of your shifts to log hours for payroll.</p>
             
             <div className="mb-6">
                <label className="block text-sm font-black text-gray-700 mb-2">Select Staff Member</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-3 font-bold bg-gray-50 focus:border-[#E4002B] focus:outline-none"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                >
                  <option value="">-- Choose your name --</option>
                  {opsData?.staff_rota?.map(staff => (
                    <option key={staff.id} value={staff.name}>{staff.name} ({staff.role})</option>
                  ))}
                </select>
             </div>

             <div className="flex justify-center gap-4 mt-6 border-t border-gray-100 pt-6">
                <button 
                  onClick={() => {
                    if(!staffName) return alert('Select staff name first');
                    sendOpsAction('clock_in', { staffName });
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-black uppercase text-sm w-1/2 transition-colors active:scale-95"
                >
                  Clock In
                </button>
                <button 
                  onClick={() => {
                    if(!staffName) return alert('Select staff name first');
                    // Find active shift
                    const activeShift = opsData?.shifts?.find(s => s.staffName === staffName && !s.clockOut);
                    if (activeShift) {
                      sendOpsAction('clock_out', { shiftId: activeShift.id });
                    } else {
                      alert('No active shift found. Please clock in first.');
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-black uppercase text-sm w-1/2 transition-colors active:scale-95"
                >
                  Clock Out
                </button>
             </div>

             {opsData?.shifts && opsData.shifts.filter(s => !s.clockOut).length > 0 && (
               <div className="mt-8 bg-blue-50 border border-blue-100 p-4 rounded-xl">
                 <h4 className="text-xs font-black text-blue-800 uppercase mb-2">Currently Clocked In:</h4>
                 <div className="flex flex-wrap gap-2">
                   {opsData.shifts.filter(s => !s.clockOut).map(s => (
                     <span key={s.id} className="bg-white border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                       {s.staffName}
                     </span>
                   ))}
                 </div>
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}
