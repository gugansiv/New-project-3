'use client';
import React, { useState } from 'react';
import { apiLogin, apiSignup, setToken } from '../db-sync';

export default function CustomerAuthModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('login'); // login, signup, forgot
  const [form, setForm] = useState({ phone: '', email: '', name: '', password: '', otp: '', newPassword: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: form.phone, email: form.email })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        // Mocking the OTP reception via alert for development
        alert("WhatsApp Message Received:\n\nCrispy Chicken Co.\nYour OTP code is: " + (data.message.match(/\d+/) || '123456'));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to send OTP.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_reset', phone: form.phone, email: form.email, otp: form.otp, newPassword: form.newPassword })
      });
      if (res.ok) {
        alert('Password reset successful. Please login.');
        setMode('login');
        setOtpSent(false);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to reset password.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiLogin(form.email, form.password);
        if (res.error) throw new Error(res.error);
        if (res.user.role !== 'customer') throw new Error('Invalid role.');
        setToken(res.token);
        localStorage.setItem('ccc_current_user', JSON.stringify(res.user));
        onSuccess(res.user);
      } else if (mode === 'signup') {
        // Since original API uses email, we map phone into the email field if they didn't provide email
        const pseudoEmail = form.email || `${form.phone.replace(/\D/g, '')}@phone.crispy.com`;
        const res = await apiSignup(form.name, pseudoEmail, form.password, 'customer');
        if (res.error) throw new Error(res.error);
        
        // Also update their phone number since base signup doesn't accept phone
        setToken(res.token);
        await fetch('/api/customer/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${res.token}` },
          body: JSON.stringify({ phone: form.phone })
        });
        
        localStorage.setItem('ccc_current_user', JSON.stringify(res.user));
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-[9500] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop click close */}
      <div onClick={onClose} className="absolute inset-0 cursor-default"></div>

      {/* Card Container */}
      <div className="relative w-full max-w-md skeuo-card rounded-[2rem] shadow-2xl overflow-hidden z-10 animate-scale-up border-0">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 dark:border-neutral-850 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-950/50">
          <div className="flex items-center gap-2 select-none">
            <div className="flex gap-1 h-5 items-stretch">
              <div className="w-1 bg-[#E4002B]"></div>
              <div className="w-1 bg-[#E4002B]"></div>
              <div className="w-1 bg-[#E4002B]"></div>
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[#E4002B] font-sans">
              Crispy Club VIP
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 skeuo-btn rounded-full transition-all duration-300 hover:rotate-90 cursor-pointer"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-8">
          {/* Section title */}
          <h2 className="text-sm font-black uppercase tracking-widest text-neutral-800 dark:text-white mb-6 font-sans">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>

          {error && (
            <div className="mb-6 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-[#E4002B]/20 text-[#E4002B] text-xs rounded-xl font-bold">
              {error}
            </div>
          )}
          
          {mode === 'forgot' ? (
            <form onSubmit={otpSent ? handleResetPassword : handleSendOtp} className="space-y-4">
              {!otpSent ? (
                <>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-450 leading-relaxed mb-4">
                    Enter your phone number (or email) to receive a mock WhatsApp verification code.
                  </p>
                  <div>
                    <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-450 uppercase mb-1.5 tracking-wider">Phone Number or Email</label>
                    <input
                      type="text"
                      required
                      value={form.phone || form.email}
                      onChange={e => setForm({ ...form, phone: e.target.value, email: e.target.value })}
                      className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                      placeholder="e.g. +91 9876543210 or email@domain.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full skeuo-btn-red text-white font-extrabold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-widest text-[10px] cursor-pointer mt-4"
                  >
                    {loading ? 'Sending...' : 'Send WhatsApp OTP'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1.5 tracking-wider">Enter OTP</label>
                    <input
                      type="text"
                      required
                      value={form.otp}
                      onChange={e => setForm({ ...form, otp: e.target.value })}
                      className="w-full skeuo-input rounded-xl p-3.5 text-sm font-black focus:outline-none tracking-widest text-center font-mono"
                      placeholder="------"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1.5 tracking-wider">New Password</label>
                    <input
                      type="password"
                      required
                      value={form.newPassword}
                      onChange={e => setForm({ ...form, newPassword: e.target.value })}
                      className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full skeuo-btn-red text-white font-extrabold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-widest text-[10px] cursor-pointer mt-4"
                  >
                    {loading ? 'Processing...' : 'Reset Password'}
                  </button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1.5 tracking-wider">Full Name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1.5 tracking-wider">Phone Number (Primary)</label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-455 uppercase mb-1.5 tracking-wider">
                  {mode === 'signup' ? 'Email (Optional Backup)' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required={mode === 'login'}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-black text-gray-555 dark:text-neutral-455 uppercase tracking-wider">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[9px] text-[#E4002B] hover:text-[#C30022] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full skeuo-btn-red text-white font-extrabold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-widest text-[10px] cursor-pointer mt-4"
              >
                {loading ? 'Processing...' : mode === 'login' ? 'Login Securely' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Footer switcher links */}
          <div className="mt-8 text-center border-t border-gray-100 dark:border-neutral-850 pt-6">
            {mode === 'login' ? (
              <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-450">
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-[#E4002B] hover:text-[#C30022] font-black uppercase tracking-wider ml-1 hover:underline cursor-pointer"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-450">
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-[#E4002B] hover:text-[#C30022] font-black uppercase tracking-wider ml-1 hover:underline cursor-pointer"
                >
                  Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
