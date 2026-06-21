import React, { useState, useEffect } from 'react';

export default function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem('ccc_auth_token');
        const res = await fetch('/api/admin/audit', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="p-10 font-bold">Loading Audit Logs...</div>;

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-200">
      <h2 className="text-2xl font-black mb-6 uppercase text-black tracking-tight">System Audit Logs</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-y border-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-bold text-gray-800">
            {logs.length === 0 ? (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">No audit logs available.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-xs text-gray-400">#{log.id}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-[10px] uppercase">{log.table_name}</span></td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] uppercase text-white ${
                      log.action === 'UPDATE' ? 'bg-blue-500' :
                      log.action === 'INSERT' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[10px] max-w-xs truncate" title={JSON.stringify(log.new_data || log.old_data)}>
                    {JSON.stringify(log.new_data || log.old_data)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
