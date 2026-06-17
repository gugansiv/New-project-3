'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MENU_ITEMS, INITIAL_STORES } from './store-data';
import { syncWithServer, pushToServer, apiLogin, apiSignup, apiPlaceOrder, fetchStores, fetchMenu, getToken, setToken, clearToken } from './db-sync';

// Helper component for Veg/Non-Veg badge
function VegNonVegBadge({ type }) {
  const isVeg = type === 'veg';
  return (
    <div 
      className={`w-4 h-4 flex items-center justify-center border-2 ${
        isVeg ? 'border-emerald-600' : 'border-red-600'
      } rounded p-[2px]`} 
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-red-600'}`}></div>
    </div>
  );
}

export default function Storefront() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Buckets');
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auth states
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showOrdersDrawer, setShowOrdersDrawer] = useState(false);
  
  // Dynamic menu items maintained by Admin
  const [menuItems, setMenuItems] = useState([]);

  // Categories list
  const categories = ['Buckets', 'Burgers & Wraps', 'Sides', 'Drinks'];

  // Initialize data from localStorage & sync with server
  useEffect(() => {
    const init = async () => {
      const serverDb = await syncWithServer();

      // User Profile
      const savedUser = localStorage.getItem('ccc_current_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
        setCustomerName(JSON.parse(savedUser).name);
      }

      // Menu Items
      const savedMenuItems = localStorage.getItem('ccc_menu_items');
      if (savedMenuItems) {
        setMenuItems(JSON.parse(savedMenuItems));
      } else {
        localStorage.setItem('ccc_menu_items', JSON.stringify(MENU_ITEMS));
        setMenuItems(MENU_ITEMS);
      }

      // Stores
      const savedStores = localStorage.getItem('ccc_stores');
      if (savedStores) {
        const parsed = JSON.parse(savedStores);
        setStores(parsed);
        const firstOpen = parsed.find(s => s.status === 'Open');
        setSelectedStore(firstOpen || parsed[0]);
      } else {
        localStorage.setItem('ccc_stores', JSON.stringify(INITIAL_STORES));
        setStores(INITIAL_STORES);
        const firstOpen = INITIAL_STORES.find(s => s.status === 'Open');
        setSelectedStore(firstOpen || INITIAL_STORES[0]);
      }

      // Active Orders
      const savedActiveOrders = localStorage.getItem('ccc_active_orders');
      if (savedActiveOrders) {
        const parsedOrders = JSON.parse(savedActiveOrders);
        setActiveOrders(parsedOrders);
        if (parsedOrders.length > 0) {
          setTrackingOrder(parsedOrders[parsedOrders.length - 1]);
        }
      }

      // Completed Orders
      const savedCompletedOrders = localStorage.getItem('ccc_completed_orders');
      if (savedCompletedOrders) {
        setCompletedOrders(JSON.parse(savedCompletedOrders));
      }

      // Initial push of menu items if server database is empty
      if (serverDb && !serverDb.menu_items) {
        await pushToServer({ menu_items: MENU_ITEMS });
      }
    };

    init();
  }, []);

  // Listen to storage events & poll server to keep tabs in sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ccc_menu_items' && e.newValue) {
        setMenuItems(JSON.parse(e.newValue));
      }
      if (e.key === 'ccc_stores' && e.newValue) {
        const parsed = JSON.parse(e.newValue);
        setStores(parsed);
        if (selectedStore) {
          const updatedSelected = parsed.find(s => s.id === selectedStore.id);
          if (updatedSelected) setSelectedStore(updatedSelected);
        }
      }
      if (e.key === 'ccc_active_orders' && e.newValue) {
        const parsedOrders = JSON.parse(e.newValue);
        setActiveOrders(parsedOrders);
        if (trackingOrder) {
          const updatedTracking = parsedOrders.find(o => o.id === trackingOrder.id);
          if (updatedTracking) {
            setTrackingOrder(updatedTracking);
          } else {
            setTrackingOrder(null);
          }
        }
      }
      if (e.key === 'ccc_completed_orders' && e.newValue) {
        setCompletedOrders(JSON.parse(e.newValue));
      }
      if (e.key === 'ccc_current_user') {
        if (e.newValue) {
          const parsedUser = JSON.parse(e.newValue);
          setCurrentUser(parsedUser);
          setCustomerName(parsedUser.name);
        } else {
          setCurrentUser(null);
          setCustomerName('');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Poll server periodically and update local storage & state
    const interval = setInterval(async () => {
      await syncWithServer();

      const currentMenuItems = localStorage.getItem('ccc_menu_items');
      if (currentMenuItems) {
        setMenuItems(JSON.parse(currentMenuItems));
      }
      
      const currentOrders = localStorage.getItem('ccc_active_orders');
      if (currentOrders) {
        const parsedOrders = JSON.parse(currentOrders);
        setActiveOrders(parsedOrders);
        if (trackingOrder) {
          const updatedTracking = parsedOrders.find(o => o.id === trackingOrder.id);
          if (updatedTracking) {
            setTrackingOrder(updatedTracking);
          }
        }
      }
      const currentStores = localStorage.getItem('ccc_stores');
      if (currentStores) {
        const parsed = JSON.parse(currentStores);
        setStores(parsed);
        if (selectedStore) {
          const updatedSelected = parsed.find(s => s.id === selectedStore.id);
          if (updatedSelected) setSelectedStore(updatedSelected);
        }
      }
      const currentCompleted = localStorage.getItem('ccc_completed_orders');
      if (currentCompleted) {
        setCompletedOrders(JSON.parse(currentCompleted));
      }
      const currentUserLocal = localStorage.getItem('ccc_current_user');
      if (currentUserLocal) {
        const parsedUser = JSON.parse(currentUserLocal);
        if (!currentUser || currentUser.email !== parsedUser.email) {
          setCurrentUser(parsedUser);
          setCustomerName(parsedUser.name);
        }
      } else if (currentUser) {
        setCurrentUser(null);
        setCustomerName('');
      }
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [trackingOrder, selectedStore, currentUser]);

  // Scrollspy: monitor visible categories scrollport
  useEffect(() => {
    if (typeof window === 'undefined' || menuItems.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -55% 0px',
      threshold: 0
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const categoryName = entry.target.getAttribute('data-category');
          if (categoryName) {
            setActiveCategory(categoryName);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    categories.forEach(cat => {
      const el = document.getElementById(getCategoryId(cat));
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [stores, searchQuery, menuItems]);

  // Helper to get safe element ID
  const getCategoryId = (category) => {
    return `section-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  };

  // Scroll to a category section
  const scrollToCategory = (catName) => {
    const el = document.getElementById(getCategoryId(catName));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveCategory(catName);
    }
  };

  // Add to cart
  const addToCart = (item) => {
    if (selectedStore?.status !== 'Open') {
      alert(`Sorry, ${selectedStore?.name} is currently closed. Please select an open store.`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  // Update item quantity in cart
  const updateQuantity = (itemId, amount) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.id === itemId) {
          const newQty = i.quantity + amount;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean);
    });
  };

  // Get current quantity of item in cart
  const getItemQty = (itemId) => {
    const cartItem = cart.find(i => i.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Email and Password are required.');
      return;
    }
    try {
      const data = await apiLogin(authEmail, authPassword);
      localStorage.setItem('ccc_current_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setCustomerName(data.user.name);
      setShowLoginModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword || !authName) {
      setAuthError('All fields are required.');
      return;
    }
    try {
      const data = await apiSignup(authName, authEmail, authPassword);
      localStorage.setItem('ccc_current_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setCustomerName(data.user.name);
      setShowLoginModal(false);
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ccc_current_user');
    clearToken();
    setCurrentUser(null);
    setCustomerName('');
    setCart([]);
  };

  // Checkout submit handler
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty.');
      return;
    }
    if (!selectedStore || selectedStore.status !== 'Open') {
      alert('Please select an open store.');
      return;
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    const newOrder = {
      id: `ord-${Math.floor(1000 + Math.random() * 9000)}`,
      storeId: selectedStore.id,
      storeName: selectedStore.name,
      items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      status: 'Pending',
      timestamp: new Date().toISOString(),
      paymentMethod,
      customerName: customerName.trim(),
      customerEmail: currentUser ? currentUser.email : 'guest@crispy.com'
    };

    // Place order via authenticated API
    try {
      const result = await apiPlaceOrder({
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        paymentMethod,
        customerName: customerName.trim()
      });
      if (result.order) {
        const currentActiveOrders = JSON.parse(localStorage.getItem('ccc_active_orders') || '[]');
        const updatedActiveOrders = [...currentActiveOrders, result.order];
        localStorage.setItem('ccc_active_orders', JSON.stringify(updatedActiveOrders));
        setActiveOrders(updatedActiveOrders);
        setTrackingOrder(result.order);
      }
    } catch (err) {
      // Fallback: save locally if API fails
      const currentActiveOrders = JSON.parse(localStorage.getItem('ccc_active_orders') || '[]');
      const updatedActiveOrders = [...currentActiveOrders, newOrder];
      localStorage.setItem('ccc_active_orders', JSON.stringify(updatedActiveOrders));
      setActiveOrders(updatedActiveOrders);
      pushToServer({ active_orders: updatedActiveOrders });
    }

    setCart([]);
    setCustomerName('');
    setShowCart(false);
    setTrackingOrder(newOrder);

    // Scroll to tracking section
    setTimeout(() => {
      const el = document.getElementById('tracking-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Filter menu items by search query
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartTax = cartSubtotal * 0.08;
  const cartTotal = cartSubtotal + cartTax;

  const PROMOS = [
    {
      id: "p1",
      title: "CHICKEN WEDNESDAY",
      desc: "Get 15% off on orders above ₹200. Code: CRUNCH15",
      color: "from-red-600 via-[#E4002B] to-red-800",
      badge: "15% OFF"
    },
    {
      id: "p2",
      title: "FREE DIET COKE COMBO",
      desc: "Buy any Mega Crunch combo and get a free drink on us.",
      color: "from-neutral-900 via-neutral-800 to-red-700",
      badge: "FREE COKE"
    },
    {
      id: "p3",
      title: "WACKY DEALS",
      desc: "Enjoy 10 pieces of crispy chicken wings for just ₹239 today.",
      color: "from-amber-600 via-[#E4002B] to-red-800",
      badge: "SPECIAL"
    }
  ];

  // Helper for order status progress steps layout
  const getStepStatus = (stepName, currentStatus) => {
    const steps = ['Pending', 'Preparing', 'Frying', 'Out for Delivery', 'Completed'];
    const currentIdx = steps.indexOf(currentStatus);
    const stepIdx = steps.indexOf(stepName);

    if (currentIdx === -1) return 'pending';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] font-sans antialiased text-black">
      <title>Crispy Chicken Co. | Crispy & Hot Fried Chicken</title>

      {/* Header Panel */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Signature 3-stripe logo */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 h-6 items-stretch">
                <div className="w-1 bg-[#E4002B]"></div>
                <div className="w-1 bg-[#E4002B]"></div>
                <div className="w-1 bg-[#E4002B]"></div>
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-black select-none">
                CRISPY CHICKEN <span className="text-[#E4002B]">CO.</span>
              </span>
            </div>

            {/* Inline location display & switcher */}
            {selectedStore && (
              <div className="hidden lg:flex items-center gap-2 bg-gray-100 py-1.5 px-3 rounded-full border border-gray-200">
                <span className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-[#E4002B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Ordering From:
                </span>
                <select
                  className="bg-transparent font-black text-xs text-black focus:outline-none cursor-pointer pr-1"
                  value={selectedStore?.id || ''}
                  onChange={(e) => {
                    const s = stores.find(store => store.id === e.target.value);
                    setSelectedStore(s);
                  }}
                >
                  {stores.map(store => (
                    <option key={store.id} value={store.id} className="text-black bg-white">
                      {store.name} ({store.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">

            {/* My Orders Button */}
            {currentUser && (
              <button
                onClick={() => setShowOrdersDrawer(true)}
                className="px-4 py-1.5 bg-white border border-gray-300 hover:border-black text-black font-extrabold text-xs uppercase rounded-full transition-all tracking-wider"
              >
                My Orders
              </button>
            )}

            {/* Sign In / User Profile */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-700 hidden md:inline">Hi, {currentUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 border border-gray-300 hover:border-red-600 text-gray-600 hover:text-[#E4002B] font-extrabold text-xs uppercase rounded-full transition-all tracking-wider animate-fade-in"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowLoginModal(true);
                  setIsSignUp(false);
                  setAuthError('');
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthName('');
                }}
                className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-extrabold text-xs uppercase rounded-full transition-all tracking-wider"
              >
                Sign In
              </button>
            )}

            {/* Shopping Cart Button (Mobile trigger) */}
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-black transition-colors"
              aria-label="View Cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E4002B] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Location Selector Strip */}
      {selectedStore && (
        <div className="lg:hidden bg-gray-100 border-b border-gray-200 py-2.5 px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-gray-700 font-bold">
            <svg className="w-4 h-4 text-[#E4002B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            </svg>
            <span>Ordering from: <span className="font-extrabold text-black">{selectedStore.name}</span></span>
          </div>
          <select
            className="bg-transparent font-black text-xs text-[#E4002B] focus:outline-none cursor-pointer"
            value={selectedStore.id}
            onChange={(e) => {
              const s = stores.find(store => store.id === e.target.value);
              setSelectedStore(s);
            }}
          >
            {stores.map(store => (
              <option key={store.id} value={store.id} className="text-black bg-white">
                {store.status === 'Open' ? 'Open' : 'Closed'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sticky Category Bar for Mobile Screen sizes */}
      <div className="sticky top-[49px] z-30 bg-white border-b border-gray-200 py-3 px-4 md:hidden overflow-x-auto no-scrollbar flex gap-2">
        {categories.map(cat => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => scrollToCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-black uppercase transition-all ${
                isActive 
                  ? 'bg-[#E4002B] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Main Column Framework Layout */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 w-full flex gap-8">
        
        {/* Left Sidebar Pane (Desktop Categories) */}
        <aside className="w-[200px] sticky top-[96px] self-start h-[calc(100vh-140px)] overflow-y-auto pr-2 hidden md:block shrink-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-6 bg-[#E4002B] rounded-full"></div>
              <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider">Categories</h4>
            </div>
            {categories.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`w-full text-left py-2.5 px-3.5 rounded-lg text-sm font-black transition-all ${
                    isActive 
                      ? 'bg-[#FFEBEE] text-[#E4002B] border-l-4 border-[#E4002B]' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Main Pane (Content, Search, Menu) */}
        <main className="flex-1 min-w-0">
          
          {/* Active Order Live Tracker */}
          {trackingOrder && (
            <section id="tracking-section" className="mb-8 bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3.5 mb-5 gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#A16207] bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">Live Order Status</span>
                  <h2 className="text-lg font-black text-black mt-1.5">Tracking Number: {trackingOrder.id}</h2>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">Store: {trackingOrder.storeName} | Total: ₹{trackingOrder.total.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setTrackingOrder(null)}
                  className="text-xs font-bold text-gray-500 hover:text-black border border-gray-300 px-3 py-1 rounded-full transition-colors bg-white hover:bg-gray-55"
                >
                  Dismiss Tracker
                </button>
              </div>

              {/* Graphical Step Progress Bar */}
              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
                {/* Connecting Line (Desktop) */}
                <div className="absolute top-[22px] left-[20px] right-[20px] h-0.5 bg-gray-200 hidden md:block -z-10">
                  <div 
                    className="h-full bg-[#E4002B] transition-all duration-500" 
                    style={{
                      width: 
                        trackingOrder.status === 'Pending' ? '0%' :
                        trackingOrder.status === 'Preparing' ? '25%' :
                        trackingOrder.status === 'Frying' ? '50%' :
                        trackingOrder.status === 'Out for Delivery' ? '75%' : '100%'
                    }}
                  ></div>
                </div>

                {[
                  { name: 'Pending', label: 'Order Placed', desc: 'Awaiting store approval', icon: '📝' },
                  { name: 'Preparing', label: 'Preparing', desc: 'Breading with spices', icon: '👨‍🍳' },
                  { name: 'Frying', label: 'Frying', desc: 'Cooking to golden crisp', icon: '🔥' },
                  { name: 'Out for Delivery', label: 'Out for Delivery', desc: 'On the way to you', icon: '🛵' },
                  { name: 'Completed', label: 'Delivered', desc: 'Enjoy your meal!', icon: '✅' }
                ].map((step, idx) => {
                  const status = getStepStatus(step.name, trackingOrder.status);
                  return (
                    <div
                      key={idx}
                      className="flex md:flex-col items-center md:text-center gap-3 md:gap-2 w-full relative"
                    >
                      {/* Circle Indicator */}
                      <div 
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-lg border-2 z-10 shrink-0 transition-all ${
                          status === 'completed' 
                            ? 'bg-emerald-500 border-emerald-600 text-white' 
                            : status === 'active' 
                              ? 'bg-[#E4002B] border-[#E4002B] text-white animate-pulse' 
                              : 'bg-white border-gray-300 text-gray-400'
                        }`}
                      >
                        {status === 'completed' ? '✓' : step.icon}
                      </div>

                      {/* Labels */}
                      <div className="flex flex-col md:items-center">
                        <span className={`text-xs font-black leading-tight ${status === 'active' ? 'text-[#E4002B]' : 'text-black'}`}>
                          {step.label}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">
                          {step.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Search bar and menu filter */}
          <div className="mb-6">
            <div className="relative flex items-center">
              <svg 
                className="absolute left-4.5 w-4.5 h-4.5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search our delicious menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-[#E4002B] rounded-full py-3 pl-12 pr-12 text-sm text-black placeholder-gray-400 font-bold focus:outline-none focus:ring-1 focus:ring-[#E4002B]/20 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 text-gray-400 hover:text-black font-bold text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Promo Deals Slider Carousel */}
          {!searchQuery && (
            <section className="mb-8">
              <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-snap-x snap-mandatory pb-2">
                {PROMOS.map(promo => (
                  <div 
                    key={promo.id} 
                    className={`snap-align-start shrink-0 w-[280px] sm:w-[360px] bg-gradient-to-r ${promo.color} text-white p-5 rounded-xl relative overflow-hidden flex flex-col justify-between h-36 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="absolute right-0 bottom-0 text-[100px] font-black text-white/5 select-none pointer-events-none translate-x-12 translate-y-12 uppercase tracking-tighter">
                      Deal
                    </div>
                    
                    <div className="z-10">
                      <span className="inline-block bg-white/20 backdrop-blur-md text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded">
                        {promo.badge}
                      </span>
                      <h3 className="text-base sm:text-lg font-black tracking-tight mt-1 leading-snug">
                        {promo.title}
                      </h3>
                    </div>
                    
                    <p className="text-xs text-white/90 font-medium leading-snug z-10">
                      {promo.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Store Closed Warning Banner */}
          {selectedStore && selectedStore.status !== 'Open' && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-950 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div>
                  <h3 className="font-extrabold text-sm">Outlet Closed</h3>
                  <p className="text-xs text-red-800 font-bold mt-0.5">
                    {selectedStore.name} is currently closed. Ordering is disabled, but you can still browse. Please select an open store.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Menu Category Sections Stack */}
          {filteredMenuItems.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center rounded-xl">
              <span className="text-4xl mb-3 select-none block">🔍</span>
              <h3 className="text-base font-black text-black">No matches found</h3>
              <p className="text-xs text-gray-500 font-bold mt-1">Try searching for other terms like &quot;burger&quot;, &quot;bucket&quot;, or &quot;fries&quot;.</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : (
            categories.map(cat => {
              const itemsInCat = filteredMenuItems.filter(item => item.category === cat);
              if (itemsInCat.length === 0) return null; // Hide categories with no matches

              return (
                <section 
                  key={cat} 
                  id={getCategoryId(cat)} 
                  data-category={cat} 
                  className="scroll-mt-32 mb-10"
                >
                  <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-2">
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
                      {cat}
                    </h2>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 py-0.5 px-2 rounded-full">
                      {itemsInCat.length} {itemsInCat.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {itemsInCat.map(item => (
                      <article 
                        key={item.id} 
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="relative h-44 sm:h-48 w-full bg-gray-50">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <VegNonVegBadge type={item.type} />
                              {item.calories && (
                                <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  🔥 {item.calories} kcal
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-extrabold text-black mb-1.5 leading-tight">
                              {item.name}
                            </h3>
                            <p className="text-xs text-gray-500 leading-normal line-clamp-2 mb-4 font-medium">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                            <span className="text-lg font-black text-black">
                              ₹{item.price.toFixed(2)}
                            </span>
                            
                            {getItemQty(item.id) > 0 ? (
                              <div className="flex items-center border border-[#E4002B] rounded-full overflow-hidden h-8">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="px-2.5 h-full text-[#E4002B] hover:bg-red-50 font-black transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  -
                                </button>
                                <span className="px-2 font-black text-xs text-black w-6 text-center select-none">
                                  {getItemQty(item.id)}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="px-2.5 h-full text-[#E4002B] hover:bg-red-50 font-black transition-colors"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                disabled={selectedStore?.status !== 'Open'}
                                className={`h-8 px-4 rounded-full bg-[#E4002B] hover:bg-[#C30022] disabled:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase flex items-center justify-center gap-1 transition-colors`}
                              >
                                Add <span className="text-sm font-bold font-sans">+</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </main>

        {/* Right Sidebar Pane (Desktop Checkout Cart) */}
        <aside className="w-[340px] sticky top-[96px] self-start h-[calc(100vh-140px)] overflow-y-auto pl-2 hidden lg:block shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                <span className="text-sm font-black text-black uppercase tracking-wider">Shopping Cart</span>
                <span className="bg-[#E4002B] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
                </span>
              </div>

              {/* Cart Items List */}
              <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="text-3xl mb-2 select-none block">🍗</span>
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Cart is Empty</h4>
                    <p className="text-[10px] text-gray-400 mt-1">Add some hot and crispy chicken items to begin your order!</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center gap-3 pb-3 border-b border-gray-50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-md border border-gray-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-black leading-snug truncate">{item.name}</h4>
                          <span className="text-[10px] font-bold text-gray-400 block">₹{item.price.toFixed(2)} each</span>
                        </div>
                      </div>

                      <div className="flex items-center border border-gray-200 rounded-full h-6 shrink-0 overflow-hidden bg-gray-50">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-1.5 h-full hover:bg-gray-100 text-xs font-bold text-gray-500"
                        >
                          -
                        </button>
                        <span className="px-1.5 font-extrabold text-[10px] text-black w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="px-1.5 h-full hover:bg-gray-100 text-xs font-bold text-gray-500"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Checkout Pricing Details */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
                <div className="space-y-1.5 text-xs font-bold text-gray-700">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-black">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST & VAT (8%)</span>
                    <span className="text-black">₹{cartTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-gray-200 pt-2.5 text-sm font-black text-black">
                    <span>Total Cost</span>
                    <span className="text-[#E4002B] text-base font-black">₹{cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={handleCheckout} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Customer Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1.5">Payment Method</label>
                    <div className="grid grid-cols-3 gap-1">
                      {['Card', 'Apple Pay', 'Cash'].map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`py-1.5 border text-[10px] font-black rounded-lg uppercase transition-colors ${
                            paymentMethod === method
                              ? 'bg-black border-black text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 mt-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors tracking-wide shadow-sm"
                  >
                    Place Order (₹{cartTotal.toFixed(2)})
                  </button>
                </form>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Bottom Shopping Cart Strip (Mobile/Tablet view) */}
      {cart.length > 0 && (
        <div className="sticky bottom-0 z-30 lg:hidden bg-white border-t border-gray-200 px-4 py-3 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 font-extrabold block">TOTAL VALUE</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-[#E4002B]">₹{cartTotal.toFixed(2)}</span>
              <span className="text-[10px] bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full font-black uppercase">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="px-6 py-2.5 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors"
          >
            View Cart 🛒
          </button>
        </div>
      )}

      {/* Footer Branding Panel */}
      <footer className="bg-black text-white border-t-4 border-[#E4002B] py-10 px-4 sm:px-8 mt-16 shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex gap-1 h-6 items-stretch mb-3">
              <div className="w-1 bg-[#E4002B]"></div>
              <div className="w-1 bg-[#E4002B]"></div>
              <div className="w-1 bg-[#E4002B]"></div>
              <span className="text-lg font-black tracking-tight text-white select-none pl-1">
                CRISPY CHICKEN <span className="text-[#E4002B]">CO.</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 font-semibold max-w-xs leading-relaxed">
              Serving the juiciest, most flavorful crispy fried chicken in town. Battered, double fried, and served fresh daily!
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3.5">STORE DIRECTORY</h4>
            <ul className="space-y-2 text-xs font-semibold text-gray-300">
              {stores.map(store => (
                <li key={store.id} className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                  <span>{store.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase ${
                    store.status === 'Open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {store.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">CRISPY CLUB DEALS</h4>
            <p className="text-xs text-gray-400 mb-3.5 font-semibold">Join our newsletter to receive promo codes, discount voucher notifications, and fresh deals!</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email Address"
                className="bg-neutral-900 border border-neutral-800 rounded-full py-1.5 px-3 text-xs w-full focus:outline-none focus:border-[#E4002B] text-white font-bold"
              />
              <button className="px-4 py-1.5 bg-[#E4002B] hover:bg-[#C30022] text-white font-black text-xs uppercase rounded-full transition-colors">
                Join
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-gray-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-500 font-bold gap-4">
          <p>© 2026 Crispy Chicken Co. All Rights Reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
            <a href="#" className="hover:text-white transition-colors">Sitemap</a>
          </div>
        </div>
      </footer>

      {/* Shopping Cart Drawer Dialog (Mobile screen size overlay) */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Blackout Backdrop */}
          <div
            onClick={() => setShowCart(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
          ></div>

          {/* Slider Panel Drawer */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-slide-in">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-black">YOUR CART</span>
                <span className="bg-[#E4002B] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
                </span>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-black border border-gray-300 transition-colors"
                aria-label="Close cart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List scroll section */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedStore && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg mb-2 text-xs font-bold text-red-950 flex justify-between items-center">
                  <span>📍 Outlet: <span className="font-extrabold underline">{selectedStore.name}</span></span>
                  <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded uppercase">{selectedStore.status}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <span className="text-5xl mb-4 select-none block">🍗</span>
                  <h3 className="text-base font-black text-black">Your cart is empty</h3>
                  <p className="text-xs text-gray-500 font-bold mt-1 max-w-xs">Fill it up with our delicious signature hot &amp; crispy buckets and combos!</p>
                  <button
                    onClick={() => setShowCart(false)}
                    className="mt-6 px-6 py-2.5 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded-md border border-gray-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-black truncate leading-snug">{item.name}</h4>
                        <span className="text-[10px] font-black text-[#E4002B] mt-0.5 block">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center border border-gray-200 rounded-full h-6 shrink-0 overflow-hidden bg-gray-55">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="px-1.5 h-full hover:bg-gray-100 text-xs font-bold text-gray-500"
                      >
                        -
                      </button>
                      <span className="px-1.5 font-extrabold text-[10px] text-black w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="px-1.5 h-full hover:bg-gray-100 text-xs font-bold text-gray-500"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Form & Pricing section */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-gray-200 bg-gray-50 space-y-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="space-y-1.5 text-xs font-bold text-gray-700">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-black">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST & VAT (8%)</span>
                    <span className="text-black">₹{cartTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-gray-200 pt-2.5 text-sm font-black text-black">
                    <span>Total Cost</span>
                    <span className="text-[#E4002B] text-base font-black">₹{cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={handleCheckout} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Customer Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black placeholder-gray-400 font-bold focus:outline-none transition-colors"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-gray-500 uppercase mb-1.5">Payment Method</label>
                    <div className="grid grid-cols-3 gap-1">
                      {['Card', 'Apple Pay', 'Cash'].map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`py-1.5 border text-[10px] font-black rounded-lg uppercase transition-colors ${
                            paymentMethod === method
                              ? 'bg-black border-black text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 mt-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors tracking-wide shadow-sm"
                  >
                    Place Order (₹{cartTotal.toFixed(2)})
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Orders Drawer (Past transactions log for customers) */}
      {showOrdersDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setShowOrdersDrawer(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
          ></div>

          {/* Drawer Panel */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-slide-in">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <span className="text-lg font-black text-black">YOUR PAST ORDERS</span>
                <span className="text-[10px] text-gray-400 font-bold block mt-0.5">{currentUser?.email}</span>
              </div>
              <button
                onClick={() => setShowOrdersDrawer(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-black border border-gray-300 transition-colors"
                aria-label="Close orders"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Combine active and completed orders for this customer */}
              {(() => {
                const customerActive = activeOrders.filter(o => o.customerEmail?.toLowerCase() === currentUser?.email?.toLowerCase());
                const customerCompleted = completedOrders.filter(o => o.customerEmail?.toLowerCase() === currentUser?.email?.toLowerCase());
                const allCustomerOrders = [...customerActive, ...customerCompleted].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                if (allCustomerOrders.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <span className="text-5xl mb-4 select-none block">🍗</span>
                      <h3 className="text-base font-black text-black">No orders found</h3>
                      <p className="text-xs text-gray-500 font-bold mt-1 max-w-xs">You haven't placed any orders yet. Place your first order today!</p>
                    </div>
                  );
                }

                return allCustomerOrders.map(order => (
                  <div key={order.id} className="bg-neutral-50 border border-gray-200 p-4 rounded-xl space-y-3 shadow-sm">
                    <div className="flex justify-between items-start border-b border-gray-200/50 pb-2">
                      <div>
                        <span className="text-xs font-black text-black">{order.id}</span>
                        <span className="text-[9px] text-gray-400 font-bold block mt-0.5">
                          {new Date(order.timestamp).toLocaleDateString()} at {new Date(order.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded border uppercase ${
                        order.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        order.status === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                        'bg-sky-50 border-sky-200 text-sky-700 animate-pulse'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    <ul className="space-y-1 text-[11px] font-bold text-gray-600">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                          <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 text-xs font-black text-black">
                      <span>Total</span>
                      <span className="text-[#E4002B]">₹{order.total.toFixed(2)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* User Login/Signup Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={() => setShowLoginModal(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          ></div>

          {/* Modal Card */}
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 z-10 border border-gray-100 flex flex-col gap-4 animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-base font-black uppercase text-black tracking-wide">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </span>
              <button
                onClick={() => setShowLoginModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-black border border-gray-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-[#E4002B] rounded-lg">
                ⚠️ {authError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. customer@crispy.com"
                  className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-white border border-gray-200 focus:border-[#E4002B] rounded-lg py-2 px-3 text-xs text-black font-bold focus:outline-none transition-colors"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-[#E4002B] hover:bg-[#C30022] text-white text-xs font-black uppercase rounded-full transition-colors tracking-wide shadow-sm"
              >
                {isSignUp ? 'Register & Log In' : 'Sign In'}
              </button>
            </form>

            {/* Toggle login/signup link */}
            <div className="text-center pt-2 border-t border-gray-100 text-[11px] font-bold text-gray-500">
              {isSignUp ? (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setAuthError('');
                    }}
                    className="text-[#E4002B] hover:underline font-extrabold"
                  >
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(true);
                      setAuthError('');
                    }}
                    className="text-[#E4002B] hover:underline font-extrabold"
                  >
                    Create one
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
