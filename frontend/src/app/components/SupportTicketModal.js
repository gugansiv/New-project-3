'use client';
import React, { useState } from 'react';
import { getToken } from '../db-sync';

export default function SupportTicketModal({ isOpen, orderId, onClose }) {
  const [subject, setSubject] = useState(orderId ? `Issue with order ${orderId}` : '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const token = getToken();
      const res = await fetch('/api/customer/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subject, message })
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit ticket');
      }
    } catch (err) {
      setError('An error occurred.');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-[9500] flex items-center justify-center p-4 animate-fade-in">
        {/* Backdrop click close */}
        <div onClick={onClose} className="absolute inset-0 cursor-default"></div>

        <div className="relative w-full max-w-md skeuo-card rounded-[2rem] shadow-2xl p-8 text-center z-10 animate-scale-up border-0">
          <div className="w-16 h-16 skeuo-well text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-wider font-sans mb-2">Ticket Submitted</h2>
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-450 mb-6 leading-relaxed">Our support team will get back to you via WhatsApp shortly.</p>
          <button onClick={onClose} className="skeuo-btn-emerald text-white font-extrabold py-3 px-8 rounded-xl transition cursor-pointer text-[10px] uppercase tracking-wider">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-[9500] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop click close */}
      <div onClick={onClose} className="absolute inset-0 cursor-default"></div>

      <div className="relative w-full max-w-md skeuo-card rounded-[2rem] shadow-2xl overflow-hidden z-10 animate-scale-up border-0">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-neutral-850 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-950/50">
          <h2 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest font-sans">Contact Support</h2>
          <button onClick={onClose} className="p-2 skeuo-btn rounded-full hover:rotate-90 transition duration-300 cursor-pointer">✕</button>
        </div>
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-[#E4002B]/20 text-[#E4002B] text-xs rounded-xl font-bold">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-450 uppercase mb-1.5 tracking-wider">Subject</label>
              <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors" placeholder="What do you need help with?" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-550 dark:text-neutral-450 uppercase mb-1.5 tracking-wider">Message</label>
              <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full skeuo-input rounded-xl p-3.5 text-xs font-semibold focus:outline-none transition-colors resize-none" placeholder="Describe your issue in detail..."></textarea>
            </div>
            <button type="submit" disabled={submitting} className="w-full skeuo-btn-emerald text-white font-extrabold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-widest text-[10px] cursor-pointer mt-4">
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
