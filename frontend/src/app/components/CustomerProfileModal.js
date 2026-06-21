'use client';
import React, { useState, useEffect } from 'react';
import { getToken } from '../db-sync';

export default function CustomerProfileModal({ isOpen, user, onClose, onLogout, initialTab = 'profile' }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [profileForm, setProfileForm] = useState({ name: user.name || '', phone: user.phone || '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Loyalty wallet and address states loaded dynamically
  const [loyaltyData, setLoyaltyData] = useState({ balance: 0, transactions: [] });
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Address creation sub-form
  const [newAddressName, setNewAddressName] = useState('');
  const [newAddressDetails, setNewAddressDetails] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);

  // Fetch account data on drawer mount / open
  const fetchAccountData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      // 1. Fetch Profile (to get saved addresses)
      const profileRes = await fetch('/api/customer/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setProfileForm({ name: profile.name || '', phone: profile.phone || '' });
        setAddresses(profile.saved_addresses || []);
      }

      // 2. Fetch Loyalty Data
      const loyaltyRes = await fetch('/api/customer/loyalty', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (loyaltyRes.ok) {
        const loyalty = await loyaltyRes.json();
        setLoyaltyData(loyalty);
      }
    } catch (err) {
      console.error('Error loading account details:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccountData();
    // Synchronize initialTab if it changes
    setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const token = getToken();
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profileForm)
      });
      if (res.ok) {
        setMessage('Profile updated successfully.');
        // Update local storage so page.js updates
        const updatedUser = { ...user, ...profileForm };
        localStorage.setItem('ccc_current_user', JSON.stringify(updatedUser));
      } else {
        setMessage('Failed to update profile.');
      }
    } catch (err) {
      setMessage('Error saving profile.');
    }
    setSaving(false);
  };

  // Saved addresses actions (PUT update back to profile)
  const saveAddressesToDB = async (updatedList) => {
    try {
      const token = getToken();
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...profileForm, saved_addresses: updatedList })
      });
      if (res.ok) {
        setAddresses(updatedList);
        return true;
      }
    } catch (err) {
      console.error('Error updating addresses:', err);
    }
    return false;
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddressName || !newAddressDetails) return;
    setAddingAddress(true);
    const newAddr = { id: 'addr_' + Date.now(), name: newAddressName, details: newAddressDetails };
    const updated = [...addresses, newAddr];
    const success = await saveAddressesToDB(updated);
    if (success) {
      setNewAddressName('');
      setNewAddressDetails('');
    }
    setAddingAddress(false);
  };

  const handleDeleteAddress = async (id) => {
    const updated = addresses.filter(addr => addr.id !== id);
    await saveAddressesToDB(updated);
  };

  return (
    <div className="fixed inset-0 z-[9500] flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md transition-opacity duration-300"
      ></div>

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md skeuo-card h-full shadow-2xl flex flex-col justify-between z-10 animate-slide-in rounded-r-none rounded-l-[2rem] sm:rounded-l-[2.5rem] border-y-0 border-r-0">
        
        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 select-none">
              <div className="flex gap-1 h-5 items-stretch">
                <div className="w-1 bg-[#E4002B]"></div>
                <div className="w-1 bg-[#E4002B]"></div>
                <div className="w-1 bg-[#E4002B]"></div>
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#E4002B] font-sans">
                My Account
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 skeuo-btn rounded-full transition-all duration-300 hover:rotate-90 cursor-pointer"
              aria-label="Close details"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-wider font-sans">{user.name}</h2>
            <p className="text-[11px] text-gray-400 dark:text-neutral-550 font-bold tracking-wide mt-0.5">{user.email}</p>
          </div>

          {/* Segmented Pill Tabs */}
          <div className="flex skeuo-well p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeTab === 'profile'
                  ? 'skeuo-btn-red text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('loyalty')}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeTab === 'loyalty'
                  ? 'skeuo-btn-red text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Wallet
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeTab === 'addresses'
                  ? 'skeuo-btn-red text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Addresses
            </button>
          </div>

          {/* Tab Contents */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-gray-250 border-t-[#E4002B] rounded-full animate-spin"></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mt-4 animate-pulse">Loading Details...</span>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Profile details tab */}
              {activeTab === 'profile' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#E4002B] font-sans mb-4">Profile details</h3>
                  {message && (
                    <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-[#E4002B]/20 text-[#E4002B] text-xs rounded-xl font-bold">
                      {message}
                    </div>
                  )}
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-450 uppercase mb-1.5 tracking-wider">Full Name</label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-450 uppercase mb-1.5 tracking-wider">Phone Number</label>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-450 uppercase mb-1.5 tracking-wider">Email (Locked)</label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full skeuo-input opacity-60 rounded-xl p-3.5 text-xs font-semibold cursor-not-allowed"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full skeuo-btn-red text-white font-extrabold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-widest text-[10px] cursor-pointer mt-4"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}

              {/* Loyalty wallet tab */}
              {activeTab === 'loyalty' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#E4002B] font-sans mb-2">Loyalty Wallet</h3>
                  
                  {/* VIP Club Membership Card Widget */}
                  <div className="relative overflow-hidden skeuo-gold-card text-yellow-950 rounded-3xl p-6 shadow-xl group select-none">
                    <div className="absolute right-0 bottom-0 w-32 h-32 bg-yellow-955/5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700"></div>
                    <div className="absolute -left-10 -top-10 w-24 h-24 bg-yellow-955/10 rounded-full blur-xl"></div>
                    
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-900 block">CRISPY CLUB MEMBERSHIP</span>
                        <span className="text-[9px] text-yellow-800 font-bold block mt-0.5">VIP Tier Pass</span>
                      </div>
                      <div className="flex gap-1 h-5 items-stretch opacity-60">
                        <div className="w-1 bg-yellow-950"></div>
                        <div className="w-1 bg-yellow-950"></div>
                        <div className="w-1 bg-yellow-950"></div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-[9px] text-yellow-850 uppercase font-bold tracking-wider block">Available Balance</span>
                      <div className="text-3xl font-black tracking-tight flex items-baseline gap-1.5 mt-1 font-sans text-yellow-950">
                        {loyaltyData?.balance || 0} <span className="text-xs font-bold text-yellow-900 uppercase tracking-widest">pts</span>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-yellow-955/10 flex justify-between items-center text-[9px] font-black tracking-wider text-yellow-900">
                      <span>ID: CCC-{user.id?.substring(0, 8).toUpperCase() || 'MEMBER'}</span>
                      <span className="text-yellow-950">REDEEM RATE: 10 pts = ₹1</span>
                    </div>
                  </div>

                  {/* Transaction log */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white mb-4">Transaction History</h4>
                    <div className="space-y-3.5">
                      {loyaltyData?.transactions?.length > 0 ? (
                        loyaltyData.transactions.map(tx => (
                          <div
                            key={tx.id}
                            className="flex justify-between items-center p-4 skeuo-card rounded-2xl transition-shadow"
                          >
                            <div className="flex items-center gap-3">
                              {/* Earned vs Redeemed icon */}
                              {tx.type === 'Earned' ? (
                                <div className="p-2 skeuo-well text-emerald-600 dark:text-emerald-400 rounded-xl">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="p-2 skeuo-well text-red-600 dark:text-red-400 rounded-xl">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                  </svg>
                                </div>
                              )}
                              <div>
                                <div className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-wider">{tx.description || tx.type}</div>
                                <div className="text-[9px] text-gray-400 mt-0.5 font-bold">{new Date(tx.timestamp).toLocaleString()}</div>
                              </div>
                            </div>
                            <div className={`text-xs font-black tracking-wider ${tx.type === 'Earned' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#E4002B]'}`}>
                              {tx.type === 'Earned' ? '+' : '-'}{tx.amount} pts
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 bg-neutral-50 dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-[11px] text-gray-400 dark:text-neutral-550 font-bold">
                          No loyalty transactions logged yet. Place orders to accumulate points!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Saved addresses tab */}
              {activeTab === 'addresses' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#E4002B] font-sans mb-4">Saved addresses</h3>
                  
                  <div className="space-y-3.5">
                    {addresses.length > 0 ? (
                      addresses.map(addr => (
                        <div
                          key={addr.id}
                          className="flex justify-between items-start p-4 skeuo-card rounded-2xl"
                        >
                          <div className="flex gap-3">
                            <div className="p-2 skeuo-well text-blue-600 dark:text-blue-400 rounded-xl mt-0.5">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div>
                              <span className="block text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-wider">{addr.name}</span>
                              <span className="block text-[10px] text-gray-550 dark:text-neutral-450 mt-1 font-semibold leading-relaxed">{addr.details}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="p-2 skeuo-btn rounded-lg text-red-600 transition-colors cursor-pointer"
                            title="Delete address"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-900 border border-dashed border-neutral-250 dark:border-neutral-800 rounded-2xl text-[11px] text-gray-400 dark:text-neutral-550 font-bold">
                        You have not saved any addresses yet.
                      </div>
                    )}
                  </div>

                  {/* Add Address Form */}
                  <div className="pt-6 border-t border-neutral-100 dark:border-neutral-850">
                    <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-white mb-4">Add new address</h4>
                    <form onSubmit={handleAddAddress} className="space-y-4">
                      <div>
                        <label className="block text-[9px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1 tracking-wider">Address Label (e.g., Home, Office)</label>
                        <input
                          type="text"
                          placeholder="Home"
                          value={newAddressName}
                          onChange={e => setNewAddressName(e.target.value)}
                          className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1 tracking-wider">Address Details</label>
                        <textarea
                          placeholder="Street, Building, Flat Number, City"
                          value={newAddressDetails}
                          onChange={e => setNewAddressDetails(e.target.value)}
                          rows={2}
                          className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors resize-none"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addingAddress}
                        className="w-full skeuo-btn font-extrabold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-widest text-[10px] cursor-pointer"
                      >
                        {addingAddress ? 'Saving Address...' : 'Add Address'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer log out button */}
        <div className="p-8 border-t border-gray-250/50 bg-transparent">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 skeuo-btn-red text-white font-extrabold text-xs uppercase rounded-2xl transition-all duration-300 tracking-wider cursor-pointer shadow-xs hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>

      </div>
    </div>
  );
}
