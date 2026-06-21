import React, { useState, useEffect } from 'react';

export default function PayrollTab() {
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        const token = localStorage.getItem('ccc_auth_token');
        const res = await fetch('/api/admin/payroll', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPayroll(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayroll();
  }, []);

  if (loading) return <div className="p-10 font-bold">Loading Payroll Data...</div>;

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-200">
      <h2 className="text-2xl font-black mb-6 uppercase text-black tracking-tight">Payroll & Finance</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-y border-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Store ID</th>
              <th className="px-4 py-3">Staff Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Total Hours</th>
              <th className="px-4 py-3 text-right">Total Pay (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-bold text-gray-800">
            {payroll.length === 0 ? (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">No payroll data available.</td></tr>
            ) : (
              payroll.map((p, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">{p.storeId}</td>
                  <td className="px-4 py-4 text-black">{p.staffName}</td>
                  <td className="px-4 py-4">{p.role}</td>
                  <td className="px-4 py-4">{p.totalHours.toFixed(2)}h</td>
                  <td className="px-4 py-4 text-right text-[#E4002B]">₹{p.totalPay.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
