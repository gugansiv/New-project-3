'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import PayrollTab from './components/PayrollTab';
import AuditTab from './components/AuditTab';
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
  getDecodedToken,
  apiAdminFetchDb,
  apiAdminPushDb,
  apiAdminUpdateStaff,
  apiFetchMessages,
  apiPostMessage,
  apiUpdateOrderStatus,
  getActiveOrdersKey,
  getCompletedOrdersKey
} from '../db-sync';

const categories = ['Buckets', 'Burgers & Wraps', 'Sides', 'Drinks'];

export default function AdminPortal() {
  const [stores, setStores] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'menu', 'orders', 'stock', 'team', 'messages', 'calendar', 'settings'
  
  // Custom interface states
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Chennai (Westside)');
  const [razorpayKey, setRazorpayKey] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // New filter/search/edit states
  const [outletSearchQuery, setOutletSearchQuery] = useState('');
  const [ordersSelectedStoreId, setOrdersSelectedStoreId] = useState('all');
  const [ordersDateFilter, setOrdersDateFilter] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserStoreId, setEditUserStoreId] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);

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

  // Editing report states
  const [editingReportId, setEditingReportId] = useState(null);
  const [editReportSales, setEditReportSales] = useState('');
  const [editReportExpenses, setEditReportExpenses] = useState('');
  const [editReportWaste, setEditReportWaste] = useState('');

  // Admin stock adjust states
  const [adminAdjustingStockId, setAdminAdjustingStockId] = useState(null);
  const [adminAdjustedStockQty, setAdminAdjustedStockQty] = useState('');

  // Calendar event form states
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventType, setNewEventType] = useState('meeting');

  // Tab selections
  const [ordersTab, setOrdersTab] = useState('active'); // 'active' or 'history'
  const [stockOpsTab, setStockOpsTab] = useState('inventory'); // 'inventory', 'outlets', 'requests', 'reports'

  // Fetch full Admin DB (reports and stock orders)
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'SUPER_ADMIN')) return;

    const fetchAdminData = async () => {
      try {
        const data = await apiAdminFetchDb();
        if (data.daily_reports) setDailyReports(data.daily_reports);
        if (data.stock_orders) setStockOrders(data.stock_orders);
        if (data.expenses) setExpenses(data.expenses);
        if (data.shifts) setShifts(data.shifts);
        if (data.waste_log) setWasteLog(data.waste_log);
        if (data.stock_items) setStockItems(data.stock_items);
        if (data.calendar_events) setCalendarEvents(data.calendar_events);
        
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

  // Poll messages every 3 seconds
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'SUPER_ADMIN')) return;
    const fetchChatMessages = async () => {
      try {
        const data = await apiFetchMessages();
        setChatMessages(data.messages || []);
      } catch (err) {
        console.warn("Failed to fetch chat messages:", err.message);
      }
    };
    fetchChatMessages();
    const interval = setInterval(fetchChatMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleStartEditReport = (rep) => {
    setEditingReportId(rep.id);
    setEditReportSales(rep.totalSales.toString());
    setEditReportExpenses(rep.totalExpenses.toString());
    setEditReportWaste(rep.totalWaste.toString());
  };

  const handleSaveEditedReport = async (reportId) => {
    try {
      const db = await apiAdminFetchDb();
      const updatedReports = db.daily_reports.map(r => {
        if (r.id === reportId) {
          return {
            ...r,
            totalSales: parseFloat(editReportSales || 0),
            totalExpenses: parseFloat(editReportExpenses || 0),
            totalWaste: parseFloat(editReportWaste || 0)
          };
        }
        return r;
      });
      await apiAdminPushDb({ daily_reports: updatedReports });
      setDailyReports(updatedReports);
      setEditingReportId(null);
      alert("Report changes saved locally! Verify and Approve to apply to store financials.");
    } catch (err) {
      alert("Failed to edit report: " + err.message);
    }
  };

  const handleAdminAdjustStock = async (stockId, storeId, newQty) => {
    try {
      const db = await apiAdminFetchDb();
      const updatedStock = db.stock_items.map(item => {
        if (item.id === stockId && item.storeId === storeId) {
          return { ...item, currentQty: parseFloat(newQty || 0) };
        }
        return item;
      });
      await apiAdminPushDb({ stock_items: updatedStock });
      setStockItems(updatedStock);
      setAdminAdjustingStockId(null);
      alert("Stock count adjusted successfully! Changes will sync to the store outlet.");
    } catch (err) {
      alert("Failed to adjust stock: " + err.message);
    }
  };

  const handleApproveReport = async (reportId) => {
    try {
      const db = await apiAdminFetchDb();
      const report = db.daily_reports.find(r => r.id === reportId);
      if (!report) return;

      const updatedReports = db.daily_reports.map(r => {
        if (r.id === reportId) return { ...r, status: 'Approved' };
        return r;
      });

      // Adjust the store's historicalRevenue by the difference between the approved sales in this report
      // and the actual orders completed for this store
      const storeId = report.storeId;
      const todaySalesInOrders = db.completed_orders
        .filter(o => o.storeId === storeId && o.timestamp.startsWith(report.date))
        .reduce((sum, o) => sum + o.total, 0);

      const adjustment = report.totalSales - todaySalesInOrders;

      const updatedStores = db.stores.map(s => {
        if (s.id === storeId) {
          return {
            ...s,
            historicalRevenue: Math.max(0, (s.historicalRevenue || 0) + adjustment)
          };
        }
        return s;
      });

      await apiAdminPushDb({ 
        daily_reports: updatedReports,
        stores: updatedStores
      });
      setDailyReports(updatedReports);
      setStores(updatedStores);
      alert("Daily report approved! Store financial sales totals synchronized.");
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

      // Remove deprecated local storage keys to ensure clean client state
      localStorage.removeItem('ccc_razorpay_key');
      localStorage.removeItem('ccc_razorpay_secret');
      const savedDarkMode = localStorage.getItem('ccc_dark_mode') === 'true';
      setDarkMode(savedDarkMode);
      if (savedDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

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
      const adminToken = getToken();
      const savedUser = localStorage.getItem('ccc_current_user');
      if (adminToken && savedUser) {
        try {
          const decoded = getDecodedToken();
          if (decoded && (decoded.role === 'admin' || decoded.role === 'SUPER_ADMIN' || decoded.role === 'BRANCH_MANAGER') && decoded.exp > Date.now() / 1000) {
            setCurrentUser(JSON.parse(savedUser));
          } else {
            localStorage.removeItem('ccc_current_user');
            setCurrentUser(null);
          }
        } catch (e) {
          localStorage.removeItem('ccc_current_user');
          setCurrentUser(null);
        }
      } else {
        localStorage.removeItem('ccc_current_user');
        setCurrentUser(null);
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
      const savedActive = localStorage.getItem(getActiveOrdersKey());
      if (savedActive) {
        setActiveOrders(JSON.parse(savedActive));
      } else {
        localStorage.setItem(getActiveOrdersKey(), JSON.stringify([]));
        setActiveOrders([]);
      }

      // Completed Orders
      const savedCompleted = localStorage.getItem(getCompletedOrdersKey());
      if (savedCompleted) {
        setCompletedOrders(JSON.parse(savedCompleted));
      } else {
        localStorage.setItem(getCompletedOrdersKey(), JSON.stringify(HISTORICAL_ORDERS));
        setCompletedOrders(HISTORICAL_ORDERS);
      }
    };

    init();
  }, []);


  // Poll local storage & sync server for changes
  useEffect(() => {
    const pollStorage = async () => {
      await syncWithServer();

      const active = localStorage.getItem(getActiveOrdersKey());
      if (active) setActiveOrders(JSON.parse(active));

      const completed = localStorage.getItem(getCompletedOrdersKey());
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
    localStorage.setItem(getActiveOrdersKey(), JSON.stringify(updatedOrders));
    setActiveOrders(updatedOrders);
    pushToServer({ active_orders: updatedOrders });
  };

  const saveCompletedOrdersToStorage = (updatedOrders) => {
    localStorage.setItem(getCompletedOrdersKey(), JSON.stringify(updatedOrders));
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
      if (data.user.role !== 'admin' && data.user.role !== 'SUPER_ADMIN') {
        setAuthError('Access Denied. You must be an administrator.');
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

  const handleStartEditUser = (user) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserPassword('');
    setEditUserStoreId(user.storeId || '');
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
    setEditUserName('');
    setEditUserEmail('');
    setEditUserPassword('');
    setEditUserStoreId('');
  };

  const handleSaveUser = async (userId) => {
    if (!editUserName.trim() || !editUserEmail.trim()) {
      alert('Name and Email are required.');
      return;
    }
    try {
      const payload = {
        id: userId,
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        storeId: editUserStoreId || null
      };
      if (editUserPassword.trim()) {
        payload.password = editUserPassword.trim();
      }

      const result = await apiAdminUpdateStaff(payload);
      if (result.success) {
        setUsers(result.users || []);
        localStorage.setItem('ccc_users', JSON.stringify(result.users || []));
        if (result.stores) {
          setStores(result.stores);
          localStorage.setItem('ccc_stores', JSON.stringify(result.stores));
        }
        setEditingUserId(null);
        alert('User updated successfully!');
      }
    } catch (err) {
      alert('Failed to update user: ' + err.message);
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
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const result = await apiUpdateOrderStatus(orderId, newStatus);
      if (result.active_orders) {
        localStorage.setItem(getActiveOrdersKey(), JSON.stringify(result.active_orders));
        setActiveOrders(result.active_orders);
      }
      if (result.completed_orders) {
        localStorage.setItem(getCompletedOrdersKey(), JSON.stringify(result.completed_orders));
        setCompletedOrders(result.completed_orders);
      }
      await syncWithServer();
    } catch (err) {
      console.warn('Failed to update order status via API, falling back to local update:', err.message);
      const orderToUpdate = activeOrders.find(o => o.id === orderId);
      if (!orderToUpdate) return;

      if (newStatus === 'Completed' || newStatus === 'Rejected') {
        const completedOrder = {
          ...orderToUpdate,
          status: newStatus,
          completedTimestamp: new Date().toISOString()
        };

        const updatedActive = activeOrders.filter(o => o.id !== orderId);
        const updatedCompleted = [completedOrder, ...completedOrders];

        saveActiveOrdersToStorage(updatedActive);
        saveCompletedOrdersToStorage(updatedCompleted);

        if (newStatus === 'Completed') {
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
        }

      } else {
        const updatedActive = activeOrders.map(o => {
          if (o.id === orderId) {
            return { ...o, status: newStatus };
          }
          return o;
        });
        saveActiveOrdersToStorage(updatedActive);
      }
    }
  };

  const cancelOrder = (orderId) => {
    updateOrderStatus(orderId, 'Rejected');
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
    // Calculate live revenue from completed orders belonging to this store
    const storeCompletedOrders = completedOrders.filter(o => o.storeId === store.id && o.status === 'Completed');
    const liveRevenue = storeCompletedOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const liveOrdersCount = storeCompletedOrders.length;

    const revenue = liveRevenue + parseFloat(store.historicalRevenue || 0);
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
      margin,
      liveOrdersCount
    };
  };

  const financialData = stores.map(store => ({
    store,
    financials: getStoreFinancials(store)
  }));

  // Overview Stats
  const totalRevenue = financialData.reduce((sum, d) => sum + d.financials.revenue, 0);
  const totalCompletedOrdersCount = completedOrders.filter(o => o.status === 'Completed').length;
  const activeOrdersCount = activeOrders.length;
  const totalOrders = totalCompletedOrdersCount + activeOrdersCount;
  const aov = totalCompletedOrdersCount > 0 ? totalRevenue / totalCompletedOrdersCount : (totalOrders > 0 ? totalRevenue / totalOrders : 0);
  const openStoresCount = stores.filter(s => s.status === 'Open').length;

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'SUPER_ADMIN')) {
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

  // Roster & Theme Helpers
  const getAvatarUrl = (name) => {
    const colors = ['E4002B', '10B981', '3B82F6', 'F59E0B', '8B5CF6'];
    const idx = name.charCodeAt(0) % colors.length;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${colors[idx]}&color=fff&bold=true`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 17) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  };

  const handleToggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('ccc_dark_mode', newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSaveRazorpayConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('ccc_razorpay_key', razorpayKey);
    localStorage.setItem('ccc_razorpay_secret', razorpaySecret);
    alert('Razorpay key and secret saved successfully!');
  };

  const filteredMenuItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCompletedOrders = completedOrders.filter(order =>
    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderDashboard = () => {
    const totalCustomers = new Set([
      ...completedOrders.map(o => o.customerName),
      ...activeOrders.map(o => o.customerName)
    ]).size || 0;

    // Dynamically calculate hourly revenue trend
    const timeSlots = [
      { label: '10:00', hours: [9, 10], amount: 0 },
      { label: '12:00', hours: [11, 12], amount: 0 },
      { label: '14:00', hours: [13, 14], amount: 0 },
      { label: '16:05', hours: [15, 16], amount: 0 },
      { label: '18:00', hours: [17, 18], amount: 0 },
      { label: '20:00', hours: [19, 20], amount: 0 },
      { label: '22:00', hours: [21, 22], amount: 0 }
    ];

    completedOrders.forEach(order => {
      try {
        const orderHour = new Date(order.timestamp).getHours();
        const slot = timeSlots.find(ts => ts.hours.includes(orderHour));
        if (slot) {
          slot.amount += order.total;
        }
      } catch (e) {}
    });

    const maxAmount = Math.max(...timeSlots.map(ts => ts.amount), 1000);
    const points = timeSlots.map((ts, idx) => {
      const x = 50 + idx * 70;
      const y = 180 - (ts.amount / maxAmount) * 150;
      return { x, y, amount: ts.amount };
    });

    const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
    const areaD = `${pathD} L 470,180 L 50,180 Z`;

    // Dynamically calculate status split percentages
    const completedCount = completedOrders.filter(o => o.status === 'Completed').length;
    const preparingCount = activeOrders.filter(o => ['Preparing', 'Frying', 'Breading', 'Out for Delivery'].includes(o.status)).length;
    const pendingCount = activeOrders.filter(o => o.status === 'Pending').length;
    const totalStatusCount = completedCount + preparingCount + pendingCount;

    const pctCompleted = totalStatusCount > 0 ? (completedCount / totalStatusCount) : 0.65;
    const pctPreparing = totalStatusCount > 0 ? (preparingCount / totalStatusCount) : 0.20;
    const pctPending = totalStatusCount > 0 ? (pendingCount / totalStatusCount) : 0.15;

    const circumference = 2 * Math.PI * 70; // ~439.82
    const offsetCompleted = circumference * (1 - pctCompleted);
    const offsetPreparing = circumference * (1 - pctPreparing);
    const offsetPending = circumference * (1 - pctPending);

    const allRecentTx = [...activeOrders, ...completedOrders]
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 3);

    return (
      <div className="space-y-6 animate-scale-in text-left">
        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Gross Sales</span>
            <h3 className="text-xl font-black tracking-tight mt-1 text-[#E4002B] dark:text-[#F33A5A]">
              ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>All stores live totals</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Total Transactions</span>
            <h3 className="text-xl font-black tracking-tight mt-1 text-black dark:text-white">
              {totalOrders}
            </h3>
            <p className="text-[9px] text-gray-500 font-bold mt-2">
              {activeOrdersCount} in Queue | {totalCompletedOrdersCount} Completed
            </p>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Average Transaction</span>
            <h3 className="text-xl font-black tracking-tight mt-1 text-black dark:text-white">
              ₹{aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[9px] font-bold text-gray-500">
              <span>AOV benchmark target: ₹250</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest block">Customers</span>
            <h3 className="text-xl font-black tracking-tight mt-1 text-emerald-600 dark:text-emerald-400">
              {totalCustomers}
            </h3>
            <p className="text-[9px] text-gray-550 dark:text-neutral-400 font-bold mt-2">Unique storefront order accounts</p>
          </div>
        </div>

        {/* Visual Analytics Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider">📈 Network Revenue Trend (Hourly)</h4>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-50 dark:bg-red-950/20 text-[#E4002B] border border-red-200 dark:border-red-900/40 rounded">Live data</span>
            </div>
            <div className="w-full">
              <svg viewBox="0 0 500 200" className="w-full h-48">
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E4002B" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#E4002B" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <line x1="50" y1="30" x2="480" y2="30" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3,3" className="stroke-gray-200 dark:stroke-neutral-800" />
                <line x1="50" y1="80" x2="480" y2="80" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3,3" className="stroke-gray-200 dark:stroke-neutral-800" />
                <line x1="50" y1="130" x2="480" y2="130" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3,3" className="stroke-gray-200 dark:stroke-neutral-800" />
                <line x1="50" y1="180" x2="480" y2="180" stroke="#E5E7EB" strokeWidth="1" className="stroke-gray-200 dark:stroke-neutral-800" />
                
                <path
                  d={areaD}
                  fill="url(#colorRev)"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#E4002B"
                  strokeWidth="3"
                />
                
                {points.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r="5" fill="#E4002B" stroke="#FFF" strokeWidth="2" />
                ))}

                <text x="50" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">10:00</text>
                <text x="120" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">12:00</text>
                <text x="190" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">14:00</text>
                <text x="260" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">16:00</text>
                <text x="330" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">18:00</text>
                <text x="400" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">20:00</text>
                <text x="470" y="195" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">22:00</text>
              </svg>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-3">🛎️ Order Status Split</h4>
            <div className="relative flex justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-40">
                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#F3F4F6" strokeWidth="20" className="stroke-gray-150 dark:stroke-neutral-800" />
                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#10B981" strokeWidth="20"
                  strokeDasharray="439.8" strokeDashoffset={offsetCompleted} strokeLinecap="round" transform="rotate(-90 100 100)" />
                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#F59E0B" strokeWidth="20"
                  strokeDasharray="439.8" strokeDashoffset={offsetPreparing} strokeLinecap="round" transform={`rotate(${-90 + 360 * pctCompleted} 100 100)`} />
                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#EF4444" strokeWidth="20"
                  strokeDasharray="439.8" strokeDashoffset={offsetPending} strokeLinecap="round" transform={`rotate(${-90 + 360 * (pctCompleted + pctPreparing)} 100 100)`} />
                
                <text x="100" y="95" textAnchor="middle" className="text-xs font-black fill-black dark:fill-white">Status Split</text>
                <text x="100" y="115" textAnchor="middle" className="text-[9px] font-bold fill-gray-400">All Outlets</text>
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[9px] font-black text-center pt-2 border-t border-gray-100 dark:border-neutral-800">
              <div>
                <span className="inline-block w-2 h-2 rounded bg-emerald-500 mr-1"></span>
                <span className="text-gray-500">Delivered</span>
                <div className="text-black dark:text-white mt-0.5">{Math.round(pctCompleted * 100)}%</div>
              </div>
              <div>
                <span className="inline-block w-2 h-2 rounded bg-amber-500 mr-1"></span>
                <span className="text-gray-500">Preparing</span>
                <div className="text-black dark:text-white mt-0.5">{Math.round(pctPreparing * 100)}%</div>
              </div>
              <div>
                <span className="inline-block w-2 h-2 rounded bg-red-500 mr-1"></span>
                <span className="text-gray-500">Pending</span>
                <div className="text-black dark:text-white mt-0.5">{Math.round(pctPending * 100)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-2.5">🔥 Hot of the Day</h4>
            <div className="space-y-3">
              {menuItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 rounded-lg transition-colors border border-gray-100/50 dark:border-neutral-800">
                  <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-gray-150 dark:border-neutral-700" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold text-black dark:text-white block truncate">{item.name}</span>
                    <span className="text-[9px] text-[#E4002B] font-extrabold">₹{item.price} | {item.calories} kcal</span>
                    <div className="flex gap-1.5 items-center mt-1">
                      <span className="text-[9px] text-amber-500">★★★★★</span>
                      <span className="text-[8px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1 py-0.2 rounded font-black">Top seller</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-2.5">🏷️ Storefront Deals</h4>
            <div className="space-y-3">
              {[
                { code: 'CRISPY50', desc: '50% off up to ₹150 on first order', tag: 'Active' },
                { code: 'CHICKENCOMBOS', desc: 'Extra ₹100 Off on Buckets & Combos', tag: 'Active' },
                { code: 'FREECOKE', desc: 'Complimentary cold drinks above ₹499', tag: 'Weekend' }
              ].map((dl, idx) => (
                <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/20 border border-gray-200/50 dark:border-neutral-800 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-xs font-black uppercase tracking-wider text-black dark:text-white bg-white dark:bg-[#2A2A2A] px-2 py-0.5 rounded border border-gray-200 dark:border-neutral-700 shadow-sm">{dl.code}</span>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-250 dark:border-emerald-900/30">{dl.tag}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold">{dl.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-2.5">💬 Live Order Feed</h4>
            <div className="space-y-3">
              {allRecentTx.map((tx, idx) => (
                <div key={idx} className="text-[10px] border-b border-gray-100 dark:border-neutral-800 pb-2.5 last:border-0 last:pb-0 font-bold">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-black dark:text-white font-extrabold">{tx.customerName}</span>
                    <span className={`px-1.5 py-0.2 rounded font-black text-[8px] uppercase ${
                      tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                      tx.status === 'Rejected' ? 'bg-red-50 text-red-600 dark:bg-red-950/20' :
                      'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                    }`}>{tx.status}</span>
                  </div>
                  <p className="text-gray-500 dark:text-neutral-400 font-medium">{tx.storeName} | ₹{tx.total.toFixed(2)}</p>
                </div>
              ))}
              {allRecentTx.length === 0 && (
                <div className="text-[10px] text-gray-400 italic">No recent transactions.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMenu = () => {
    return (
      <section className="space-y-6 animate-scale-in text-left">
        <div className="flex justify-between items-center bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div>
            <h2 className="text-sm font-black uppercase text-black dark:text-white">Customer Menu Manager</h2>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">Maintain customer storefront items, prices, descriptions, and categories.</p>
          </div>
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-all shadow-sm cursor-pointer"
          >
            {showAddItem ? 'Close Form' : '➕ Create Menu Item'}
          </button>
        </div>

        {showAddItem && (
          <form onSubmit={handleAddMenuItem} className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl space-y-4 max-w-2xl shadow-sm text-left">
            <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2">Add New Menu Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Double Crunch Combo"
                  className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-neutral-700 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Category *</label>
                <select
                  className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-neutral-700 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors"
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
                  className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-neutral-700 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Calories (kcal)</label>
                <input
                  type="number"
                  placeholder="e.g. 650"
                  className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-neutral-700 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors"
                  value={newItemCalories}
                  onChange={(e) => setNewItemCalories(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Type *</label>
                <div className="flex gap-4 py-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-neutral-300 cursor-pointer">
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
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-neutral-300 cursor-pointer">
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
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Custom Image URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://image-url.com"
                  className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-neutral-700 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Description</label>
                <textarea
                  placeholder="Give a mouth-watering description..."
                  rows="2"
                  className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-neutral-700 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="px-4 py-1.5 border border-gray-300 dark:border-neutral-700 rounded-full font-bold text-xs uppercase bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
              >
                Save Menu Item
              </button>
            </div>
          </form>
        )}

        <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-neutral-100/50 dark:bg-neutral-800/40 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-800 uppercase font-black">
                  <th className="p-3">Preview</th>
                  <th className="p-3">Item Details</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 font-bold text-gray-700 dark:text-neutral-350">
                {filteredMenuItems.map(item => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                    <td className="p-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 object-cover rounded-md border border-gray-100 dark:border-neutral-850 shrink-0"
                      />
                    </td>
                    <td className="p-3">
                      <div className="text-black dark:text-white font-extrabold text-sm">{item.name}</div>
                      <div className="text-[10px] text-gray-400 font-bold max-w-xs truncate">{item.description}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5">🔥 {item.calories} kcal</div>
                    </td>
                    <td className="p-3">
                      <span className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-0.5 rounded-full font-extrabold uppercase text-[9px]">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 uppercase">
                      <span className={item.type === 'veg' ? 'text-emerald-600' : 'text-[#E4002B]'}>
                        {item.type} {item.type === 'veg' ? '🟢' : '🔴'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-black dark:text-white">
                      {editingItemId === item.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            className="w-16 bg-white dark:bg-[#2C2C2C] border border-gray-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-right font-extrabold text-black dark:text-white text-xs focus:outline-none"
                            value={editingItemPrice}
                            onChange={(e) => setEditingItemPrice(e.target.value)}
                          />
                          <button
                            onClick={() => handleSaveItemPrice(item.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-2 py-0.5 font-extrabold cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-extrabold text-sm">₹{item.price.toFixed(2)}</span>
                          <button
                            onClick={() => handleStartEditPrice(item)}
                            className="text-gray-400 hover:text-black dark:hover:text-white font-bold cursor-pointer"
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
                        className="text-gray-400 hover:text-red-655 text-red-500 font-extrabold uppercase text-[10px] transition-colors px-2 py-1 cursor-pointer"
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
    );
  };

  const renderOrders = () => {
    // 1. Filter orders based on store outlet and date picker
    const filterByStoreAndDate = (order) => {
      // Filter by store ID
      if (ordersSelectedStoreId !== 'all') {
        if (order.storeId !== ordersSelectedStoreId) return false;
      }
      // Filter by date
      if (ordersDateFilter) {
        const orderDateStr = new Date(order.timestamp).toISOString().split('T')[0];
        if (orderDateStr !== ordersDateFilter) return false;
      }
      // Filter by general search query if any
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesQuery = 
          order.id.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.storeName.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }
      return true;
    };

    const ordersToDisplayActive = activeOrders.filter(filterByStoreAndDate);
    const ordersToDisplayCompleted = completedOrders.filter(filterByStoreAndDate);

    // Calculate accepted vs rejected counts for the pie chart
    // accepted = completed.Completed + active.all
    // rejected = completed.Rejected
    const filteredAccepted = ordersToDisplayCompleted.filter(o => o.status === 'Completed').length + ordersToDisplayActive.length;
    const filteredRejected = ordersToDisplayCompleted.filter(o => o.status === 'Rejected').length;
    const totalPieCount = filteredAccepted + filteredRejected;

    const acceptedPct = totalPieCount > 0 ? (filteredAccepted / totalPieCount) * 100 : 100;
    const rejectedPct = totalPieCount > 0 ? (filteredRejected / totalPieCount) * 100 : 0;

    const pieCircumference = 2 * Math.PI * 50; // ~314.16
    const acceptedOffset = pieCircumference * (1 - (acceptedPct / 100));
    const rejectedOffset = pieCircumference * (1 - (rejectedPct / 100));
    const rejectedRotation = -90 + (360 * (acceptedPct / 100));

    return (
      <section className="space-y-6 animate-scale-in text-left">
        {/* Title & Tab Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm gap-4">
          <div>
            <h2 className="text-sm font-black uppercase text-black dark:text-white">Transactions Control Queue</h2>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">Overview of active storefront orders and historical balance logs.</p>
          </div>
          <div className="flex gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full self-stretch md:self-auto justify-center">
            <button
              onClick={() => setOrdersTab('active')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-full transition-all cursor-pointer ${
                ordersTab === 'active' ? 'bg-[#E4002B] text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              🛎️ Active Queue ({ordersToDisplayActive.length})
            </button>
            <button
              onClick={() => setOrdersTab('history')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-full transition-all cursor-pointer ${
                ordersTab === 'history' ? 'bg-[#E4002B] text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              📖 Completed Journal ({ordersToDisplayCompleted.length})
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div>
            <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Filter by Store Outlet</label>
            <select
              className="w-full bg-neutral-100 dark:bg-[#2D2D2D] border border-transparent focus:border-gray-300 dark:focus:border-neutral-700 rounded-lg py-1.5 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors cursor-pointer"
              value={ordersSelectedStoreId}
              onChange={(e) => setOrdersSelectedStoreId(e.target.value)}
            >
              <option value="all">All Outlets</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Filter by Date</label>
            <input
              type="date"
              className="w-full bg-neutral-100 dark:bg-[#2D2D2D] border border-transparent focus:border-gray-300 dark:focus:border-neutral-700 rounded-lg py-1.5 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors cursor-pointer"
              value={ordersDateFilter}
              onChange={(e) => setOrdersDateFilter(e.target.value)}
            />
          </div>

          <div className="flex items-end justify-start md:justify-end">
            <button
              onClick={() => {
                setOrdersSelectedStoreId('all');
                setOrdersDateFilter('');
              }}
              className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-full font-bold text-[10px] uppercase bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Orders summary section with Pie Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-3">📈 Rejection Rate Analysis</h4>
            <div className="relative flex justify-center">
              <svg viewBox="0 0 160 160" className="w-full h-32">
                <circle cx="80" cy="80" r="50" fill="transparent" stroke="#F3F4F6" strokeWidth="15" className="stroke-gray-150 dark:stroke-neutral-800" />
                
                {/* Accepted slice */}
                <circle cx="80" cy="80" r="50" fill="transparent" stroke="#10B981" strokeWidth="15"
                  strokeDasharray={pieCircumference} strokeDashoffset={acceptedOffset} strokeLinecap="round" transform="rotate(-90 80 80)" />
                
                {/* Rejected slice */}
                {filteredRejected > 0 && (
                  <circle cx="80" cy="80" r="50" fill="transparent" stroke="#EF4444" strokeWidth="15"
                    strokeDasharray={pieCircumference} strokeDashoffset={rejectedOffset} strokeLinecap="round" transform={`rotate(${rejectedRotation} 80 80)`} />
                )}
                
                <text x="80" y="75" textAnchor="middle" className="text-[10px] font-black fill-black dark:fill-white">Performance</text>
                <text x="80" y="92" textAnchor="middle" className="text-[8px] font-bold fill-gray-400">Accepted vs Rejected</text>
              </svg>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-center pt-2 border-t border-gray-100 dark:border-neutral-800">
              <div>
                <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500 mr-1.5 text-left"></span>
                <span className="text-gray-500">Accepted ({filteredAccepted})</span>
                <div className="text-black dark:text-white mt-0.5">{Math.round(acceptedPct)}%</div>
              </div>
              <div>
                <span className="inline-block w-2.5 h-2.5 rounded bg-red-500 mr-1.5 text-left"></span>
                <span className="text-gray-500">Rejected ({filteredRejected})</span>
                <div className="text-black dark:text-white mt-0.5">{Math.round(rejectedPct)}%</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm lg:col-span-2 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black uppercase text-black dark:text-white tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-3">📊 Queue Summary</h4>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest block">Active Queue</span>
                  <span className="text-2xl font-black text-amber-500 block mt-1">{ordersToDisplayActive.length}</span>
                  <span className="text-[8px] text-gray-505 dark:text-neutral-400 font-bold block mt-1">Pending fulfillment</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-widest block">Completed Orders</span>
                  <span className="text-2xl font-black text-emerald-500 block mt-1">{ordersToDisplayCompleted.filter(o => o.status === 'Completed').length}</span>
                  <span className="text-[8px] text-gray-555 dark:text-neutral-400 font-bold block mt-1">Delivered successfully</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase tracking-widest block">Total Volume</span>
                  <span className="text-2xl font-black text-[#E4002B] block mt-1">₹{[...ordersToDisplayActive, ...ordersToDisplayCompleted].reduce((sum, o) => sum + o.total, 0).toFixed(2)}</span>
                  <span className="text-[8px] text-gray-550 font-bold block mt-1">Filtered gross sales</span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-[9px] font-bold text-gray-500">
              <span>* Rejection metrics are derived from store cancellations.</span>
              <span>Live Feed synced.</span>
            </div>
          </div>
        </div>

        {ordersTab === 'active' ? (
          ordersToDisplayActive.length === 0 ? (
            <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-12 text-center rounded-xl flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl mb-3">📭</span>
              <h3 className="text-sm font-black text-black dark:text-white">No active storefront orders</h3>
              <p className="text-[10px] text-gray-450 font-bold mt-1">Orders matching filters will appear here in real-time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ordersToDisplayActive.map(order => (
                <div key={order.id} className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:border-gray-300 dark:hover:border-neutral-700 transition-colors">
                  <div>
                    <div className="flex justify-between items-start border-b border-gray-100 dark:border-neutral-800 pb-3 mb-4">
                      <div>
                        <span className="text-[9px] font-black text-[#A16207] bg-amber-55 bg-amber-50 text-amber-805 text-amber-800 border-amber-200 px-2 py-0.5 rounded-full">{order.storeName}</span>
                        <h4 className="text-sm font-black text-black dark:text-white mt-1.5">{order.id}</h4>
                      </div>
                      <span className={`px-2.5 py-0.5 text-[9px] font-black rounded-full border uppercase ${
                        order.status === 'Pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        order.status === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        order.status === 'Frying' ? 'bg-red-50 text-[#E4002B] border-red-200 animate-pulse' :
                        'bg-sky-50 text-sky-700 border-sky-200'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <span className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider block text-left">Ordered Selection</span>
                      <ul className="space-y-1.5">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between items-center text-xs font-bold text-gray-600 dark:text-neutral-450">
                            <span>
                              <span className="font-extrabold text-[#E4002B]">{item.quantity}x</span> {item.name}
                            </span>
                            <span className="text-black dark:text-white font-extrabold">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="border-t border-dashed border-gray-200 dark:border-neutral-850 pt-3 mt-3 flex justify-between items-center text-[10px]">
                        <div className="text-gray-450 dark:text-neutral-400 text-left">
                          Customer: <span className="text-black dark:text-white font-extrabold">{order.customerName}</span>{order.customerPhone && (<> | Ph: <span className="text-black dark:text-white font-extrabold">{order.customerPhone}</span></>)}
                        </div>
                        <div className="text-sm font-black text-black dark:text-white">
                          Total: <span className="text-[#E4002B]">₹{order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 dark:border-neutral-800 pt-4 mt-auto flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                      {order.status === 'Pending' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Preparing')}
                          className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
                        >
                          Accept Order
                        </button>
                      )}
                      {order.status === 'Preparing' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Frying')}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
                        >
                          Start Cooking
                        </button>
                      )}
                      {order.status === 'Frying' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Out for Delivery')}
                          className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
                        >
                          Dispatch Order
                        </button>
                      )}
                      {order.status === 'Out for Delivery' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Completed')}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="px-3 py-1.5 text-gray-400 hover:text-red-500 font-extrabold text-[10px] uppercase transition-colors cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-neutral-100/50 dark:bg-neutral-800/40 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-800 uppercase font-black sticky top-0 bg-white dark:bg-[#1E1E1E] z-10">
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Outlet</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Items</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 font-bold text-gray-700 dark:text-neutral-350">
                  {ordersToDisplayCompleted.map((order, idx) => {
                    const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/55 dark:hover:bg-neutral-800/10">
                        <td className="p-3 text-black dark:text-white font-extrabold">{order.id}</td>
                        <td className="p-3 font-medium">{new Date(order.timestamp).toLocaleString()}</td>
                        <td className="p-3">{order.storeName}</td>
                        <td className="p-3">
                          {order.customerName}
                          {order.customerPhone && (
                            <span className="text-[9px] text-gray-405 dark:text-neutral-400 block font-semibold">Ph: {order.customerPhone}</span>
                          )}
                        </td>
                        <td className="p-3 uppercase">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase ${
                            order.status === 'Completed' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20' 
                              : 'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-950/20'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">{itemCount} items</td>
                        <td className="p-3 text-right text-black dark:text-white font-extrabold">₹{order.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    );
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const data = await apiPostMessage(newMessage);
      setChatMessages(data.messages || []);
      setNewMessage('');
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    }
  };

  const handleAddCalendarEvent = async (e) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) {
      alert('Event Title and Date are required.');
      return;
    }

    try {
      let updatedEvents;
      if (editingEventId !== null) {
        // Edit existing
        updatedEvents = calendarEvents.map(evt => {
          if (evt.id === editingEventId) {
            return {
              ...evt,
              title: newEventTitle.trim(),
              date: newEventDate,
              time: newEventTime || '12:00 PM',
              type: newEventType
            };
          }
          return evt;
        });
        setEditingEventId(null);
      } else {
        // Create new
        const newEvent = {
          id: Date.now(),
          title: newEventTitle.trim(),
          date: newEventDate,
          time: newEventTime || '12:00 PM',
          type: newEventType
        };
        updatedEvents = [...calendarEvents, newEvent];
      }

      await apiAdminPushDb({ calendar_events: updatedEvents });
      setCalendarEvents(updatedEvents);

      setNewEventTitle('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventType('meeting');
      alert('Calendar event saved successfully!');
    } catch (err) {
      alert('Failed to save calendar event: ' + err.message);
    }
  };

  const handleStartEditEvent = (evt) => {
    setEditingEventId(evt.id);
    setNewEventTitle(evt.title);
    setNewEventDate(evt.date);
    setNewEventTime(evt.time);
    setNewEventType(evt.type);
  };

  const handleDeleteCalendarEvent = async (eventId) => {
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        const updatedEvents = calendarEvents.filter(e => e.id !== eventId);
        await apiAdminPushDb({ calendar_events: updatedEvents });
        setCalendarEvents(updatedEvents);
      } catch (err) {
        alert('Failed to delete calendar event: ' + err.message);
      }
    }
  };

  const renderStock = () => {
    const pendingRestocksCount = stockOrders.filter(o => o.status === 'Pending').length;
    const pendingReportsCount = dailyReports.filter(r => r.status === 'Pending').length;

    return (
      <section className="space-y-6 animate-scale-in text-left">
        {/* Sub-tab Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm gap-4">
          <div>
            <h2 className="text-sm font-black uppercase text-black dark:text-white">🏢 Operations & Inventory</h2>
            <p className="text-[10px] text-gray-400 font-bold mt-0.5">Manage store outlets, check raw stock alerts, and approve daily operational audit files.</p>
          </div>
          <div className="flex flex-wrap gap-1 bg-neutral-100 dark:bg-neutral-855 dark:bg-neutral-800 p-1 rounded-full">
            {[
              { id: 'inventory', label: '📦 Stock & Audits' },
              { id: 'outlets', label: '📍 Store Directory' },
              { id: 'requests', label: `📋 Restocks (${pendingRestocksCount})` },
              { id: 'reports', label: `📊 Daily Reports (${pendingReportsCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStockOpsTab(tab.id)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-full transition-all cursor-pointer ${
                  stockOpsTab === tab.id 
                    ? 'bg-[#E4002B] text-white' 
                    : 'text-gray-500 hover:text-black dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Inventory & Audits tab */}
        {stockOpsTab === 'inventory' && (
          <div className="space-y-8">
            {/* Overall Status Monitor */}
            <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-black uppercase text-black dark:text-white mb-4 border-b border-gray-100 dark:border-neutral-850 pb-2">
                Outlet Progress & Status Monitor
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-800/40 text-gray-500 border-b border-gray-200 dark:border-neutral-800 uppercase font-black">
                      <th className="p-3">Store Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Today's Sales</th>
                      <th className="p-3 text-right">Expenses</th>
                      <th className="p-3 text-right">Waste</th>
                      <th className="p-3 text-center">Active Shifts</th>
                      <th className="p-3 text-center">Stock Alerts</th>
                      <th className="p-3 text-right">Pending Restocks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 font-bold text-gray-700 dark:text-neutral-350">
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

                      return (
                        <tr key={st.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                          <td className="p-3 text-black dark:text-white font-extrabold">{st.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase ${
                              st.status === 'Open' 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                                : 'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-950/20 dark:border-red-900/30'
                            }`}>
                              {st.status}
                            </span>
                          </td>
                          <td className="p-3 text-right text-emerald-600">₹{totalStoreSales.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#E4002B]">-₹{totalStoreExp.toLocaleString()}</td>
                          <td className="p-3 text-right text-orange-600">-₹{totalStoreWaste.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase ${
                              activeShiftsCount > 0 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                                : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-neutral-800 dark:text-neutral-550 dark:border-neutral-750'
                            }`}>
                              {activeShiftsCount} Active
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase ${
                              lowStockCount > 0 
                                ? 'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-950/20 dark:border-red-900/30 animate-pulse' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                            }`}>
                              {lowStockCount} Alert{lowStockCount !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {pendingRestocks > 0 ? (
                              <span className="bg-amber-50 text-amber-700 text-[8px] font-black border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider animate-pulse dark:bg-amber-955/20 dark:border-amber-900/30">
                                {pendingRestocks} Pending ⚠️
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">Healthy ✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Store Audit detail explorer */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                  Select Outlet to Audit
                </h4>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 pointer-events-none select-none text-xs">🔍</span>
                  <input
                    type="text"
                    placeholder="Search outlets..."
                    className="w-full bg-neutral-100 dark:bg-[#111] border border-transparent focus:border-gray-305 focus:border-gray-300 dark:focus:border-neutral-700 rounded-lg py-1.5 pl-8 pr-3 text-[11px] font-bold text-black dark:text-white placeholder-gray-450 focus:outline-none transition-colors"
                    value={outletSearchQuery}
                    onChange={(e) => setOutletSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {stores
                    .filter(st => 
                      st.name.toLowerCase().includes(outletSearchQuery.toLowerCase()) ||
                      (st.manager && st.manager.toLowerCase().includes(outletSearchQuery.toLowerCase())) ||
                      (st.address && st.address.toLowerCase().includes(outletSearchQuery.toLowerCase()))
                    )
                    .map(st => (
                      <button
                        key={st.id}
                        onClick={() => setOpsSelectedStoreId(st.id)}
                        className={`text-left p-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          opsSelectedStoreId === st.id
                            ? 'border-[#E4002B] bg-red-50/20 dark:bg-[#E4002B]/10 text-[#E4002B] font-extrabold'
                            : 'border-gray-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-gray-700 dark:text-neutral-405'
                        }`}
                      >
                        <span className="block font-black">{st.name}</span>
                        <span className="text-[9px] text-gray-400 font-normal mt-0.5 block">{st.manager} | {st.address.split(',')[0]}</span>
                      </button>
                    ))}
                </div>
              </div>

              <div className="lg:col-span-3">
                {!opsSelectedStoreId ? (
                  <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center h-full min-h-[300px]">
                    <span className="text-3xl mb-3">🏢</span>
                    <h4 className="text-sm font-black text-black dark:text-white">Select an outlet to view audit files</h4>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 max-w-xs">Detailed inventory alerts, logged expenses, employee timing logs, and waste counts will load here.</p>
                  </div>
                ) : (() => {
                  const selStore = stores.find(s => s.id === opsSelectedStoreId);
                  if (!selStore) return null;
                  const selExpenses = expenses.filter(e => e.storeId === opsSelectedStoreId);
                  const selShifts = shifts.filter(s => s.storeId === opsSelectedStoreId);
                  const selWaste = wasteLog.filter(w => w.storeId === opsSelectedStoreId);
                  const selStock = stockItems.filter(s => s.storeId === opsSelectedStoreId);

                  return (
                    <div className="space-y-6 animate-fade-in">
                      <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex justify-between items-center">
                        <div>
                          <h3 className="text-sm font-black uppercase text-black dark:text-white">{selStore.name} — Full Details & Status</h3>
                          <span className="text-[10px] text-gray-400 font-bold mt-0.5">Operational Audit Console</span>
                        </div>
                        <span className="text-[10px] font-black bg-neutral-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-300 px-3 py-1 rounded">
                          ID: {selStore.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Stock Inventory Audit */}
                        <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                            🥔 Inventory Alert Status
                          </h4>
                          {selStock.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-6 text-center">No inventory items loaded.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selStock.map(item => {
                                const isLow = item.currentQty <= item.minQty;
                                return (
                                  <div key={item.id} className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-neutral-350 py-1.5 border-b border-gray-100 dark:border-neutral-850 last:border-0">
                                    <span>{item.itemName}</span>
                                    <div className="flex items-center gap-2">
                                      {adminAdjustingStockId === item.id ? (
                                        <div className="flex gap-1 items-center">
                                          <input
                                            type="number"
                                            className="w-16 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-[11px] text-black dark:text-white font-bold focus:outline-none"
                                            value={adminAdjustedStockQty}
                                            onChange={(e) => setAdminAdjustedStockQty(e.target.value)}
                                          />
                                          <button
                                            onClick={() => handleAdminAdjustStock(item.id, opsSelectedStoreId, adminAdjustedStockQty)}
                                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black rounded uppercase cursor-pointer"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={() => setAdminAdjustingStockId(null)}
                                            className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[9px] font-black rounded uppercase cursor-pointer"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-black dark:text-white font-extrabold">{item.currentQty} / {item.minQty} {item.unit}</span>
                                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                            isLow 
                                              ? 'bg-red-50 border border-red-205 text-[#E4002B] dark:bg-red-955/20 dark:border-red-900/30 animate-pulse' 
                                              : 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                                          }`}>
                                            {isLow ? 'Low' : 'OK'}
                                          </span>
                                          <button
                                            onClick={() => {
                                              setAdminAdjustingStockId(item.id);
                                              setAdminAdjustedStockQty(item.currentQty.toString());
                                            }}
                                            className="text-blue-600 hover:text-blue-800 text-[9px] uppercase font-black cursor-pointer"
                                          >
                                            Adjust ✎
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Shift Work Logs */}
                        <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                            ⏱️ Today's Staff Timing Logs
                          </h4>
                          {selShifts.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-6 text-center">No shift records found for today.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selShifts.map(shift => (
                                <div key={shift.id} className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-neutral-350 p-2 bg-neutral-50 dark:bg-neutral-800/40 rounded border border-gray-200/50 dark:border-neutral-800">
                                  <div>
                                    <span className="text-black dark:text-white font-extrabold block">{shift.staffName}</span>
                                    <span className="text-[9px] text-gray-400 font-normal block mt-0.5">
                                      {new Date(shift.clockIn).toLocaleTimeString()} - {shift.clockOut ? new Date(shift.clockOut).toLocaleTimeString() : 'Clocked In'}
                                    </span>
                                  </div>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${
                                    !shift.clockOut 
                                      ? 'bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-955/20 dark:border-emerald-900/30 animate-pulse' 
                                      : 'bg-gray-100 border-gray-200 text-gray-505 dark:bg-neutral-800 dark:border-neutral-700'
                                  }`}>
                                    {!shift.clockOut ? 'Active' : 'Offline'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Logged Expenses Ledger */}
                        <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                            💸 Custom Expenses Logged
                          </h4>
                          {selExpenses.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-6 text-center">No custom expenses logged today.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selExpenses.map(exp => (
                                <div key={exp.id} className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-neutral-350 border-b border-gray-100 dark:border-neutral-850 pb-2 last:border-0">
                                  <div>
                                    <span className="text-black dark:text-white font-extrabold">{exp.description || exp.category}</span>
                                    <span className="text-[9px] text-gray-400 font-normal block mt-0.5">{new Date(exp.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <span className="text-[#E4002B] font-extrabold">₹{exp.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Wasted Ingredients Log */}
                        <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                            🗑️ Food Spoilage & Wastage
                          </h4>
                          {selWaste.length === 0 ? (
                            <p className="text-xs text-gray-400 font-bold py-6 text-center">No wastage entries logged today.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selWaste.map(waste => (
                                <div key={waste.id} className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-neutral-350 border-b border-gray-100 dark:border-neutral-850 pb-2 last:border-0">
                                  <div>
                                    <span className="text-black dark:text-white font-extrabold">{waste.itemName} (x{waste.quantity})</span>
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
          </div>
        )}

        {/* 2. Store Directory tab */}
        {stockOpsTab === 'outlets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
              <div>
                <h3 className="text-xs font-black uppercase text-black dark:text-white">Outlet Location Registry</h3>
                <p className="text-[10px] text-gray-450 font-bold mt-0.5">Toggle outlet operations, review baseline data, or open new store locations.</p>
              </div>
              <button
                onClick={() => setShowAddStore(!showAddStore)}
                className="px-4 py-1.5 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white font-black text-xs uppercase rounded-full transition-all shadow-sm cursor-pointer"
              >
                {showAddStore ? 'Close Form' : '➕ Create Outlet'}
              </button>
            </div>

            {/* Add Store Form */}
            {showAddStore && (
              <form onSubmit={handleAddStore} className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl space-y-4 max-w-2xl shadow-sm">
                <h3 className="text-sm font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">Add New Location Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Store Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Northside Drive-Thru"
                      className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
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
                      className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                      value={newStoreManager}
                      onChange={(e) => setNewStoreManager(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 500 Central Ave, Chennai"
                      className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                      value={newStoreAddress}
                      onChange={(e) => setNewStoreAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Monthly Rent (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 150000"
                      className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                      value={newStoreRent}
                      onChange={(e) => setNewStoreRent(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Staff Count</label>
                    <input
                      type="number"
                      placeholder="e.g. 8"
                      className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                      value={newStoreStaff}
                      onChange={(e) => setNewStoreStaff(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Daily Target (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 75000"
                      className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white placeholder-gray-400 font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                      value={newStoreTarget}
                      onChange={(e) => setNewStoreTarget(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-neutral-850">
                  <button
                    type="button"
                    onClick={() => setShowAddStore(false)}
                    className="px-4 py-1.5 border border-gray-300 dark:border-neutral-750 rounded-full font-bold text-xs uppercase bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-55 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
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
                const storeFinancials = getStoreFinancials(store);

                return (
                  <div 
                    key={store.id} 
                    className="bg-white dark:bg-[#1E1E1E] border border-gray-205 border-gray-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm hover:border-gray-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between h-56"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-black dark:text-white text-base">{store.name}</h3>
                          <span className="text-[10px] text-gray-400 font-bold block mt-0.5">{store.address}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded border uppercase ${
                          isOpen 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                            : 'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-955/20 dark:border-red-900/30'
                        }`}>
                          {store.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] font-bold text-gray-500 dark:text-neutral-450 border-t border-b border-gray-100 dark:border-neutral-850 py-3">
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider font-sans">Manager</span>
                          <span className="text-black dark:text-white font-extrabold mt-0.5 block truncate">{store.manager}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider font-sans">Staff Size</span>
                          <span className="text-black dark:text-white font-extrabold mt-0.5 block">{store.staffCount} Workers</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase block tracking-wider font-sans">Gross Sales</span>
                          <span className="text-[#E4002B] font-extrabold mt-0.5 block truncate">
                            ₹{storeFinancials.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-auto pt-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleStoreStatus(store.id)}
                          className={`px-3 py-1.5 border rounded-full text-[10px] font-black uppercase transition-colors cursor-pointer ${
                            isOpen
                              ? 'border-red-300 text-[#E4002B] hover:bg-red-55 dark:hover:bg-red-955/10'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-955/10'
                          }`}
                        >
                          {isOpen ? 'Close' : 'Open'}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteStore(store.id)}
                          className="px-3 py-1.5 border border-red-200 hover:border-red-650 text-red-500 hover:text-white hover:bg-[#E4002B] rounded-full text-[10px] font-black uppercase transition-all cursor-pointer"
                          title="Delete Store Location"
                        >
                          🗑️
                        </button>
                      </div>

                      <Link
                        href={`/store/${store.id}`}
                        className="px-4 py-1.5 bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 dark:text-black rounded-full text-[10px] font-black uppercase transition-colors tracking-wide flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        POS Console ⚙️
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Restocks Desk tab */}
        {stockOpsTab === 'requests' && (
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
              📋 Restock Requests Validation Desk
            </h3>
            {stockOrders.filter(o => o.status === 'Pending').length === 0 ? (
              <div className="p-8 text-center text-gray-400 font-bold">No pending stock requests require verification. All outlets fully supplied.</div>
            ) : (
              <div className="space-y-4">
                {stockOrders.filter(o => o.status === 'Pending').map(order => (
                  <div key={order.id} className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-gray-200/50 dark:border-neutral-800 flex flex-col justify-between gap-3 animate-scale-in">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-black dark:text-white">{order.storeName}</span>
                        <span className="text-[10px] text-gray-405 block mt-0.5">Submitted by {order.requestedBy} | {new Date(order.timestamp).toLocaleString()}</span>
                      </div>
                      <span className="text-[9px] bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 px-2 py-0.5 rounded uppercase font-black">
                        ID: {order.id}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {order.items.map((item, idx) => (
                        <span key={idx} className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 px-2.5 py-1 rounded text-[10px] font-bold text-gray-700 dark:text-neutral-350">
                          {item.itemName} <span className="font-extrabold text-[#E4002B]">+{item.quantity} {item.unit}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-neutral-850 mt-1 justify-end">
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
                        className="px-4 py-1.5 border border-red-200 text-[#E4002B] hover:bg-red-50 dark:hover:bg-red-955/10 text-[10px] font-black uppercase rounded-full transition-colors cursor-pointer"
                      >
                        Reject ✕
                      </button>
                      <button
                        onClick={() => handleApproveStockOrder(order.id)}
                        className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-full transition-colors shadow-sm cursor-pointer"
                      >
                        Verify & Dispatch ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Daily Reports Validation tab */}
        {stockOpsTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                📊 Daily Reports Audit & Approval Desk
              </h3>
              {dailyReports.filter(r => r.status === 'Pending').length === 0 ? (
                <p className="text-xs text-gray-400 font-bold py-6 text-center">No pending daily reports require audit approval.</p>
              ) : (
                <div className="space-y-4">
                  {dailyReports.filter(r => r.status === 'Pending').map(rep => (
                    <div key={rep.id} className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-gray-200/50 dark:border-neutral-800 flex flex-col justify-between gap-3 animate-scale-in">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-black text-black dark:text-white">{rep.storeName}</span>
                          <span className="text-[10px] text-gray-450 block mt-0.5">Submitted by {rep.submittedBy} on {new Date(rep.submittedAt).toLocaleTimeString()}</span>
                        </div>
                        <span className="text-[9px] bg-blue-50 dark:bg-blue-955/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 px-2 py-0.5 rounded uppercase font-black">
                          Date: {rep.date}
                        </span>
                      </div>
                      
                      {editingReportId === rep.id ? (
                        <div className="space-y-3 p-3 bg-white dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700">
                          <span className="text-[9px] font-black text-gray-400 uppercase block">Edit Report Audit Details</span>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[8px] font-black text-gray-450 uppercase mb-1">Sales (₹)</label>
                              <input
                                type="number"
                                className="w-full bg-white dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs text-black dark:text-white font-bold focus:outline-none"
                                value={editReportSales}
                                onChange={(e) => setEditReportSales(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-gray-450 uppercase mb-1">Expenses (₹)</label>
                              <input
                                type="number"
                                className="w-full bg-white dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs text-black dark:text-white font-bold focus:outline-none"
                                value={editReportExpenses}
                                onChange={(e) => setEditReportExpenses(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-gray-450 uppercase mb-1">Waste (₹)</label>
                              <input
                                type="number"
                                className="w-full bg-white dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs text-black dark:text-white font-bold focus:outline-none"
                                value={editReportWaste}
                                onChange={(e) => setEditReportWaste(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => setEditingReportId(null)}
                              className="px-3 py-1 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-350 text-[9px] font-black uppercase rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEditedReport(rep.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase rounded cursor-pointer"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 py-2 text-center bg-white dark:bg-[#151515] rounded border border-gray-100 dark:border-neutral-850">
                            <div className="p-1">
                              <span className="text-[8px] font-black text-gray-450 uppercase block font-sans">Sales</span>
                              <span className="text-xs font-extrabold text-emerald-600">₹{rep.totalSales.toLocaleString()}</span>
                            </div>
                            <div className="p-1">
                              <span className="text-[8px] font-black text-gray-405 uppercase block font-sans">Expenses</span>
                              <span className="text-xs font-extrabold text-[#E4002B]">₹{rep.totalExpenses.toLocaleString()}</span>
                            </div>
                            <div className="p-1">
                              <span className="text-[8px] font-black text-gray-405 uppercase block font-sans">Waste</span>
                              <span className="text-xs font-extrabold text-orange-600">₹{rep.totalWaste.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1 justify-end items-center">
                            <button
                              onClick={() => handleStartEditReport(rep)}
                              className="text-blue-600 hover:text-blue-800 text-[10px] uppercase font-black mr-auto cursor-pointer"
                            >
                              Edit Audit ✏️
                            </button>
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
                              className="px-4 py-1.5 border border-red-200 text-[#E4002B] hover:bg-red-55 dark:hover:bg-red-955/10 text-[10px] font-black uppercase rounded-full transition-colors cursor-pointer"
                            >
                              Reject ✕
                            </button>
                            <button
                              onClick={() => handleApproveReport(rep.id)}
                              className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-full transition-colors cursor-pointer"
                            >
                              Verify & Approve ✓
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Daily Reports Ledger */}
            <div className="bg-white dark:bg-[#1E1E1E] border border-gray-205 border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 dark:bg-neutral-800/40 border-b border-gray-200 dark:border-neutral-800 p-4">
                <h3 className="text-xs font-black uppercase text-black dark:text-white font-sans">📁 Historical Daily Reports Audit Archive Ledger</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-55 dark:bg-neutral-800/20 text-gray-500 border-b border-gray-200 dark:border-neutral-800 uppercase font-black">
                      <th className="p-3">Store Name</th>
                      <th className="p-3">Report Date</th>
                      <th className="p-3 text-right">Gross Sales</th>
                      <th className="p-3 text-right">Expenses</th>
                      <th className="p-3 text-right">Waste</th>
                      <th className="p-3 text-center">Alerts</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Audit Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 font-bold text-gray-700 dark:text-neutral-350">
                    {dailyReports.filter(r => r.status === 'Approved' || r.status === 'Rejected').length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-gray-400 font-bold">No historical daily reports archived.</td>
                      </tr>
                    ) : (
                      dailyReports.filter(r => r.status === 'Approved' || r.status === 'Rejected').map(rep => (
                        <tr key={rep.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                          <td className="p-3 text-black dark:text-white font-extrabold">{rep.storeName}</td>
                          <td className="p-3">{rep.date}</td>
                          <td className="p-3 text-right text-emerald-600">₹{rep.totalSales.toFixed(2)}</td>
                          <td className="p-3 text-right text-[#E4002B]">-₹{rep.totalExpenses.toFixed(2)}</td>
                          <td className="p-3 text-right text-orange-600">-₹{rep.totalWaste.toFixed(2)}</td>
                          <td className="p-3 text-center text-gray-500">
                            {rep.activeShiftsCount} shifts / {rep.stockAlertsCount} alerts
                          </td>
                          <td className="p-3">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${
                              rep.status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-[#E4002B]'
                            }`}>
                              {rep.status}
                            </span>
                          </td>
                          <td className="p-3 text-right text-gray-400 text-[10px]">{new Date(rep.submittedAt).toLocaleDateString()} {new Date(rep.submittedAt).toLocaleTimeString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderTeam = () => {
    return (
      <section className="space-y-6 animate-scale-in text-left">
        <div className="flex justify-between items-center bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div>
            <h2 className="text-sm font-black uppercase text-black dark:text-white">👥 Team Rota & Manager Registry</h2>
            <p className="text-[10px] text-gray-450 font-bold mt-0.5">Add and manage outlet managers and track real-time shift clock-in rosters.</p>
            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200 dark:border-emerald-900/50 inline-block">
              <span className="block uppercase text-[9px] mb-0.5 text-emerald-800 dark:text-emerald-500 font-black">Development Notice</span>
              Test System Admin: admin@crispy.com | Test Branch Manager: naresh@gmail.com | Password for both: password123
            </div>
          </div>
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-all shadow-sm cursor-pointer"
          >
            {showAddItem ? 'Close Form' : '➕ Create Manager Account'}
          </button>
        </div>

        {/* Create login form */}
        {showAddItem && (
          <form onSubmit={handleAddStaff} className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl space-y-4 max-w-2xl shadow-sm animate-scale-in">
            <h3 className="text-sm font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">Create Store Manager Login</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Manager Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
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
                  className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
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
                  className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Store Assignment</label>
                <select
                  className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
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
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-neutral-850">
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="px-4 py-1.5 border border-gray-300 dark:border-neutral-750 rounded-full font-bold text-xs uppercase bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors shadow-sm cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* Directory Table */}
        <div className="bg-white dark:bg-[#1E1E1E] border border-gray-205 border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-neutral-100/50 dark:bg-neutral-800/40 text-gray-500 border-b border-gray-200 dark:border-neutral-800 uppercase font-black">
                  <th className="p-3">Staff Profile</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Outlet Assignment</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3 text-center">Shift Status</th>
                  <th className="p-3 text-right">Roster Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 font-bold text-gray-700 dark:text-neutral-350">
                {users.map((user, idx) => {
                  const assignedStore = stores.find(s => s.id === user.storeId);
                  const isShiftActive = shifts.some(s => s.staffName === user.name && !s.clockOut);
                  const empId = `EMP-${1000 + idx}`;
                  
                  if (editingUserId === user.id) {
                    return (
                      <tr key={user.id} className="bg-neutral-50/70 dark:bg-neutral-800/30">
                        <td className="p-3">
                          <input
                            type="text"
                            required
                            className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 text-xs font-bold text-black dark:text-white"
                            value={editUserName}
                            onChange={(e) => setEditUserName(e.target.value)}
                          />
                        </td>
                        <td className="p-3 font-mono text-gray-500 dark:text-gray-400">{empId}</td>
                        <td className="p-3">
                          <select
                            className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 text-xs font-bold text-black dark:text-white cursor-pointer"
                            value={editUserStoreId}
                            onChange={(e) => setEditUserStoreId(e.target.value)}
                          >
                            <option value="">Global Administration</option>
                            {stores.map(store => (
                              <option key={store.id} value={store.id}>{store.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20">
                            STORE MANAGER
                          </span>
                        </td>
                        <td className="p-3 space-y-1">
                          <input
                            type="email"
                            required
                            className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 text-xs font-bold text-black dark:text-white"
                            value={editUserEmail}
                            onChange={(e) => setEditUserEmail(e.target.value)}
                          />
                          <input
                            type="password"
                            placeholder="New password (optional)"
                            className="w-full bg-white dark:bg-[#2D2D2D] border border-gray-300 dark:border-neutral-700 rounded px-2 py-1 text-[10px] font-bold text-black dark:text-white"
                            value={editUserPassword}
                            onChange={(e) => setEditUserPassword(e.target.value)}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-gray-400 font-semibold">-</span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleSaveUser(user.id)}
                            className="text-emerald-600 hover:text-emerald-800 font-black uppercase text-[10px] cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditUser}
                            className="text-gray-500 hover:text-gray-700 dark:hover:text-neutral-300 font-black uppercase text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                      <td className="p-3 flex items-center gap-3">
                        <img
                          src={getAvatarUrl(user.name)}
                          alt={user.name}
                          className="w-8 h-8 rounded-full border border-gray-100 dark:border-neutral-750 shrink-0"
                        />
                        <span className="text-black dark:text-white font-extrabold">{user.name}</span>
                      </td>
                      <td className="p-3 font-mono text-gray-500 dark:text-gray-400">{empId}</td>
                      <td className="p-3 text-black dark:text-white font-extrabold">
                        {assignedStore ? assignedStore.name : <span className="text-gray-400 font-bold">Global Administration</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${
                          (user.role === 'admin' || user.role === 'SUPER_ADMIN') 
                            ? 'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-950/20 dark:border-red-905/30' 
                            : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30'
                        }`}>
                          {(user.role === 'admin' || user.role === 'SUPER_ADMIN') ? 'SYSTEM ADMIN' : 'STORE MANAGER'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-650 dark:text-gray-400">{user.email}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wide ${
                          isShiftActive 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 animate-pulse' 
                            : 'bg-gray-105 border-gray-200 text-gray-400 dark:bg-neutral-800 dark:border-neutral-750'
                        }`}>
                          {isShiftActive ? 'On Duty 🟢' : 'Off Duty ⚪'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {user.id !== 'usr-admin' ? (
                          <>
                            <button
                              onClick={() => handleStartEditUser(user)}
                              className="text-amber-605 text-amber-600 hover:text-amber-800 font-black uppercase text-[10px] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-[#E4002B] hover:text-red-800 font-black uppercase text-[10px] cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-300 dark:text-neutral-700 font-black uppercase text-[10px] select-none">System Account</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  };

  const renderMessages = () => {
    return (
      <section className="animate-scale-in text-left flex border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm h-[600px] bg-white dark:bg-[#1C1C1C]">
        {/* Chat Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#151515] p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2 tracking-wider">
              Communication Center
            </h3>
            <div className="space-y-1">
              {['#general-chat', '#operations-hub', '#restock-support', '#manager-direct'].map((channel, i) => (
                <button
                  key={channel}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    i === 1 
                      ? 'bg-[#E4002B] text-white font-extrabold shadow-sm' 
                      : 'text-gray-500 hover:bg-neutral-100 dark:hover:bg-neutral-800/40 text-gray-700 dark:text-neutral-400'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    💬 {channel}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-neutral-800 pt-3 text-[10px] text-gray-400 dark:text-gray-500 font-bold">
            🟢 Operations Broadcast System
          </div>
        </div>

        {/* Chat Main Panel */}
        <div className="flex-1 flex flex-col justify-between bg-white dark:bg-[#1E1E1E]">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#1C1C1C]">
            <div>
              <h4 className="text-xs font-black uppercase text-black dark:text-white">💬 #operations-hub</h4>
              <p className="text-[9px] text-gray-400 font-bold mt-0.5">Real-time status coordination channel with Outlet Managers.</p>
            </div>
            <span className="text-[9px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30 font-black animate-pulse">
              Live broadcast
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[440px]">
            {chatMessages.map(msg => {
              const isMe = msg.sender === currentUser?.name || msg.senderRole === 'admin' || msg.senderRole === 'SUPER_ADMIN';
              return (
                <div key={msg.id} className={`flex gap-3 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse text-right' : 'text-left'}`}>
                  <img
                    src={getAvatarUrl(msg.sender)}
                    alt={msg.sender}
                    className="w-8 h-8 rounded-full border border-gray-150 dark:border-neutral-700 shrink-0 self-start mt-1"
                  />
                  <div>
                    <div className={`flex items-baseline gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-xs font-black text-black dark:text-white">{msg.sender}</span>
                      <span className="text-[8px] text-gray-400 font-bold">[{msg.storeName || 'System'}] • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className={`mt-1.5 p-3 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${
                      isMe 
                        ? 'bg-[#E4002B] text-white rounded-tr-none' 
                        : 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 rounded-tl-none border border-gray-200/50 dark:border-neutral-750'
                    }`}>
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Form Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-neutral-800 flex gap-2 bg-gray-50/50 dark:bg-neutral-850/20">
            <input
              type="text"
              placeholder="Broadcast a message to outlet managers..."
              className="flex-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-805 focus:border-[#E4002B] rounded-full py-2 px-4 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              className="px-5 py-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm cursor-pointer font-bold"
            >
              Send Chat
            </button>
          </form>
        </div>
      </section>
    );
  };

  const renderCalendar = () => {
    return (
      <section className="space-y-6 animate-scale-in text-left">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Create Event and Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Create Event Form */}
            <form onSubmit={handleAddCalendarEvent} className="bg-white dark:bg-[#1E1E1E] border border-gray-205 border-gray-200 dark:border-neutral-800 p-5 rounded-xl space-y-4 shadow-sm animate-scale-in">
              <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                📅 Schedule Operations Event
              </h3>
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Health & Safety Inspection"
                  className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 02:00 PM"
                    className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Event Category *</label>
                <select
                  className="w-full bg-white dark:bg-[#111] border focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black dark:text-white font-bold focus:outline-none transition-colors border-gray-300 dark:border-neutral-800"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                >
                  <option value="audit">Location Audit 📍</option>
                  <option value="delivery">Restock Dispatch 📦</option>
                  <option value="meeting">Business Meeting 💼</option>
                  <option value="maintenance">Kitchen Repair ⚙️</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors shadow-sm cursor-pointer font-bold mt-2"
              >
                {editingEventId !== null ? 'Update Event Schedule' : 'Add Schedule Entry'}
              </button>
              {editingEventId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingEventId(null);
                    setNewEventTitle('');
                    setNewEventDate('');
                    setNewEventTime('');
                    setNewEventType('meeting');
                  }}
                  className="w-full py-1.5 border border-gray-300 dark:border-neutral-700 rounded-full font-bold text-xs uppercase bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-350 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer mt-1"
                >
                  Cancel Edit
                </button>
              )}
            </form>

            {/* Upcoming items overview */}
            <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-4 rounded-xl shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">
                Operational Rota Events ({calendarEvents.length})
              </h4>
              <div className="space-y-3">
                {calendarEvents.map(evt => (
                  <div key={evt.id} className="flex justify-between items-start text-xs font-bold text-gray-700 dark:text-neutral-350 border-b border-gray-105 dark:border-neutral-850 pb-3 last:border-0 last:pb-0">
                    <div className="flex gap-3">
                      <span className="text-2xl select-none">
                        {evt.type === 'audit' ? '📍' : evt.type === 'delivery' ? '📦' : evt.type === 'meeting' ? '💼' : '⚙️'}
                      </span>
                      <div>
                        <span className="text-black dark:text-white font-extrabold block">{evt.title}</span>
                        <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">{evt.date} • {evt.time}</span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border block mt-1.5 w-max ${
                          evt.type === 'audit' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-955/20' :
                          evt.type === 'delivery' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-955/20' :
                          evt.type === 'meeting' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-955/20' :
                          'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-955/20'
                        }`}>
                          {evt.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <button
                        onClick={() => handleStartEditEvent(evt)}
                        className="text-[10px] text-amber-600 hover:text-amber-805 font-black uppercase cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCalendarEvent(evt.id)}
                        className="text-[10px] text-[#E4002B] hover:text-red-800 font-black uppercase cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Monthly Grid mock */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-neutral-850 pb-3">
              <h3 className="text-xs font-black uppercase text-black dark:text-white tracking-wider font-sans">
                📅 June 2026 Operations Calendar
              </h3>
              <span className="text-[10px] text-gray-500 font-black">Admin scheduling view</span>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center font-black uppercase text-[9px] text-gray-400 dark:text-gray-500 border-b border-gray-50 dark:border-neutral-850 pb-2">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            {/* Monthly Grid mock (June 2026 starts on Mon, has 30 days) */}
            <div className="grid grid-cols-7 gap-2 h-[420px]">
              {/* Offset for Sunday (blank) */}
              <div className="bg-gray-50/20 dark:bg-neutral-800/10 rounded border border-transparent"></div>
              
              {/* Day slots 1 to 30 */}
              {Array.from({ length: 30 }).map((_, idx) => {
                const day = idx + 1;
                const dateString = `2026-06-${day < 10 ? '0' + day : day}`;
                const dayEvents = calendarEvents.filter(e => e.date === dateString);

                return (
                  <div key={day} className="bg-neutral-50/50 dark:bg-neutral-800/10 rounded border border-gray-100 dark:border-neutral-850 p-1.5 flex flex-col justify-between hover:border-gray-300 dark:hover:border-neutral-700 transition-colors">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 block text-left">{day}</span>
                    
                    <div className="space-y-1 mt-1 max-h-[70px] overflow-y-auto pr-0.5 no-scrollbar">
                      {dayEvents.map(evt => (
                        <div
                          key={evt.id}
                          className={`text-[8px] font-black px-1 py-0.5 rounded border truncate ${
                            evt.type === 'audit' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-955/20' :
                            evt.type === 'delivery' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-955/20' :
                            evt.type === 'meeting' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-955/20' :
                            'bg-red-50 border-red-200 text-[#E4002B] dark:bg-red-955/20'
                          }`}
                          title={`${evt.title} (${evt.time})`}
                        >
                          {evt.title.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderSettings = () => {
    return (
      <section className="space-y-6 animate-scale-in text-left max-w-4xl">
        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col gap-4">
          <h2 className="text-sm font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">💳 Payment Gateway & System Configurations</h2>
          
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-4 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-350">
            🔒 **Payment Configuration**: The payment gateway is securely configured server-side. Razorpay credentials are loaded from environment variables (`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`) on the server to prevent leakage of credentials in the browser cache.
          </div>
        </div>

        {/* Brand details and settings configurations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">🏢 Brand Information</h3>
            <div className="space-y-2.5 text-xs text-gray-600 dark:text-neutral-400 font-bold">
              <div className="flex justify-between">
                <span>Company Name</span>
                <span className="text-black dark:text-white font-extrabold">Crispy Chicken Co. Private Ltd.</span>
              </div>
              <div className="flex justify-between">
                <span>Corporate HQ</span>
                <span className="text-black dark:text-white font-extrabold">Chennai, Tamil Nadu, India</span>
              </div>
              <div className="flex justify-between">
                <span>Active Currency</span>
                <span className="text-black dark:text-white font-extrabold">INR (₹) Indian Rupee</span>
              </div>
              <div className="flex justify-between">
                <span>System Contact</span>
                <span className="text-black dark:text-white font-extrabold">sysadmin@crispychicken.co</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-black dark:text-white border-b border-gray-100 dark:border-neutral-850 pb-2">⚙️ System Preferences</h3>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-neutral-350 block">High contrast Dark Theme</span>
                  <span className="text-[9px] text-gray-400 font-bold block mt-0.5">Toggle dark styling across the control panel.</span>
                </div>
                <button
                  onClick={handleToggleTheme}
                  className={`px-4 py-1 border rounded-full text-[10px] font-black uppercase transition-all cursor-pointer ${
                    darkMode 
                      ? 'border-[#E4002B] text-[#E4002B] bg-[#E4002B]/10' 
                      : 'border-gray-300 text-gray-500 hover:text-black'
                  }`}
                >
                  {darkMode ? 'Dark ON 🌙' : 'Light ON ☀️'}
                </button>
              </div>

              <div className="flex justify-between items-center border-t border-gray-100 dark:border-neutral-850 pt-3">
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-neutral-350 block">Live Orders Auto-Approval</span>
                  <span className="text-[9px] text-gray-400 font-bold block mt-0.5">Automatically accept storefront orders.</span>
                </div>
                <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-750 text-gray-505 dark:text-neutral-400 font-black text-[9px] rounded uppercase select-none">
                  DISABLED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#121212] font-sans antialiased text-black dark:text-white transition-colors duration-200">
      <title>Admin Control Center | Crispy Chicken Co.</title>

      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-white dark:bg-[#1E1E1E] border-r border-gray-200 dark:border-neutral-800 flex flex-col justify-between p-6 h-screen sticky top-0 shrink-0 shadow-sm z-20">
        <div className="space-y-8">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 h-6 items-stretch">
              <div className="w-1.5 bg-[#E4002B]"></div>
              <div className="w-1.5 bg-[#E4002B]"></div>
              <div className="w-1.5 bg-[#E4002B]"></div>
            </div>
            <span className="text-lg font-black tracking-tight text-black dark:text-white select-none uppercase">
              Crispy Chicken <span className="text-[#E4002B]">Co.</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'menu', label: 'Menu List', icon: '🍔' },
              { id: 'orders', label: 'Order List', icon: '🛎️', count: activeOrdersCount },
              { id: 'stock', label: 'Product Stock', icon: '🏢', count: (dailyReports.filter(r => r.status === 'Pending').length + stockOrders.filter(o => o.status === 'Pending').length) || null },
              { id: 'payroll', label: 'Payroll', icon: '💰' },
              { id: 'team', label: 'Team Roster', icon: '👥' },
              { id: 'messages', label: 'Messages', icon: '💬' },
              { id: 'calendar', label: 'Calendar Rota', icon: '📅' },
              { id: 'audit', label: 'Audit Logs', icon: '📜' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#E4002B] text-white shadow-md'
                      : 'text-gray-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/40 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-sm select-none">{tab.icon}</span>
                    {tab.label}
                  </span>
                  {tab.count ? (
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${isActive ? 'bg-white text-[#E4002B]' : 'bg-red-50 text-[#E4002B] dark:bg-[#E4002B]/10 dark:text-red-400'} animate-pulse`}>
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-neutral-855 dark:border-neutral-800">
          {/* Dark theme toggle button */}
          <button
            onClick={handleToggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black text-gray-550 dark:text-neutral-450 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>{darkMode ? '🌙' : '☀️'}</span>
            {darkMode ? 'Dark Mode ON' : 'Light Mode ON'}
          </button>

          {/* Storefront button */}
          <Link
            href="/"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black text-gray-550 dark:text-neutral-450 hover:text-[#E4002B] dark:hover:text-red-400 transition-colors"
          >
            <span>➜</span>
            View Storefront
          </Link>

          {/* Logout button */}
          <button
            onClick={handleAdminLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black text-red-550 dark:text-red-455 hover:text-[#C30022] hover:bg-red-50 dark:hover:bg-red-955/20 rounded-xl transition-all cursor-pointer"
          >
            <span>🔒</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-black text-[#E4002B] uppercase tracking-wider font-sans">{getGreeting()}</span>
            <h1 className="text-base font-black text-black dark:text-white uppercase tracking-tight mt-0.5">Control Center</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative w-64 hidden sm:block">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none select-none text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search menu or orders..."
                className="w-full bg-neutral-100 dark:bg-[#111] border border-transparent focus:border-gray-300 dark:focus:border-neutral-700 rounded-full py-2 pl-9 pr-4 text-xs font-bold text-black dark:text-white placeholder-gray-400 focus:outline-none transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Chennai Location Dropdown */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2 rounded-full border border-gray-200/50 dark:border-neutral-750 text-xs font-bold">
              <span className="mr-1.5 select-none">📍</span>
              <select
                className="bg-transparent text-black dark:text-white focus:outline-none font-black text-[11px] cursor-pointer"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
              >
                <option value="Chennai (Westside)">Chennai (Westside)</option>
                <option value="Chennai (OMR)">Chennai (OMR)</option>
                <option value="Chennai (Velachery)">Chennai (Velachery)</option>
              </select>
            </div>

            {/* Date Display */}
            <div className="hidden lg:flex items-center bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2 rounded-full border border-gray-200/50 dark:border-neutral-750 text-xs font-bold font-mono">
              📅 {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>

            {/* Notification Badge Popover */}
            <div className="relative">
              <button className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-full bg-neutral-100 dark:bg-neutral-800 border border-gray-200/50 dark:border-neutral-750 text-sm select-none cursor-pointer">
                🔔
              </button>
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E4002B] text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#1E1E1E]">
                  {activeOrdersCount}
                </span>
              )}
            </div>

            {/* User Profile */}
            <div className="relative">
              <button 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 border-l border-gray-200 dark:border-neutral-850 pl-4 text-left focus:outline-none cursor-pointer bg-transparent"
              >
                <div className="relative">
                  <img
                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80"
                    alt="Profile"
                    className="w-8 h-8 rounded-full border border-gray-200 dark:border-neutral-750 shrink-0 object-cover"
                  />
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#1E1E1E] bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-left hidden md:block">
                  <span className="text-xs font-black text-black dark:text-white block">{currentUser ? currentUser.name : 'System Admin'}</span>
                  <span className="text-[9px] text-gray-400 font-bold block mt-0.5">{currentUser ? ((currentUser.role === 'admin' || currentUser.role === 'SUPER_ADMIN') ? 'Executive Suite' : 'Store Manager') : 'Executive Suite'}</span>
                </div>
                <span className="text-gray-400 text-[10px] hidden md:inline ml-1 select-none">▼</span>
              </button>

              {showProfileDropdown && (
                <>
                  {/* Click overlay to close */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowProfileDropdown(false)}
                  ></div>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2.5 w-56 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-neutral-800 shadow-xl py-2 z-50 animate-scale-in">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-850">
                      <p className="text-xs font-black text-black dark:text-white">{currentUser ? currentUser.name : 'System Admin'}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate">{currentUser ? currentUser.email : 'admin@crispychicken.co'}</p>
                    </div>
                    
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setActiveTab('settings');
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2 cursor-pointer bg-transparent border-none"
                      >
                        ⚙️ System Settings
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('team');
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2 cursor-pointer bg-transparent border-none"
                      >
                        👥 Managers Registry
                      </button>
                      <button
                        onClick={() => {
                          handleToggleTheme();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2 cursor-pointer bg-transparent border-none"
                      >
                        {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                      </button>
                    </div>

                    <div className="border-t border-gray-100 dark:border-neutral-850 pt-1 mt-1">
                      <button
                        onClick={() => {
                          handleAdminLogout();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-black text-red-655 hover:bg-red-50 dark:hover:bg-red-955/20 transition-colors flex items-center gap-2 cursor-pointer bg-transparent border-none"
                      >
                        🔒 Log Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content View Container */}
        <main className="flex-1 p-6 overflow-y-auto bg-gray-50/50 dark:bg-[#121212]">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'menu' && renderMenu()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'stock' && renderStock()}
            {activeTab === 'payroll' && <PayrollTab />}
            {activeTab === 'team' && renderTeam()}
            {activeTab === 'messages' && renderMessages()}
            {activeTab === 'calendar' && renderCalendar()}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'settings' && renderSettings()}
          </div>
        </main>
      </div>
    </div>
  );
}
