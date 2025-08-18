import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [endpoints, setEndpoints] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ method: 'GET', path: '', response: '', status: 200, delay: 0, error: false });
  const [editing, setEditing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchEndpoints();
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // auto-refresh logs every 2s
    return () => clearInterval(interval);
  }, []);

  const fetchEndpoints = async () => {
    const res = await axios.get('http://localhost:4000/api/endpoints');
    setEndpoints(res.data);
  };

  const fetchLogs = async () => {
    const res = await axios.get('http://localhost:4000/api/logs');
    // Sort logs by timestamp descending (recent first)
    const sorted = [...res.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setLogs(sorted);
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    let response;
    try {
      response = JSON.parse(form.response);
    } catch {
      response = form.response;
    }
    await axios.post('http://localhost:4000/api/endpoints', { ...form, response });
    fetchEndpoints();
    setEditing(false);
    setForm({ method: 'GET', path: '', response: '', status: 200, delay: 0, error: false });
  };

  const handleDelete = async (method, path) => {
    await axios.delete('http://localhost:4000/api/endpoints', {
      data: { method, path }
    });
    fetchEndpoints();
  };

  const handleClearLogs = async () => {
    await axios.delete('http://localhost:4000/api/logs');
    fetchLogs();
  };

  useEffect(() => {
    if (!selectedLog) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedLog]);

  return (
    <div className="app-container">
      <h2>API Interceptor</h2>
      <form onSubmit={handleSubmit} className="endpoint-form">
        <div className="form-row">
          <label>Method:
            <select name="method" value={form.method} onChange={handleChange}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>
          </label>
          <label>Path:
            <input name="path" value={form.path} onChange={handleChange} placeholder="/api/test" required />
          </label>
          <label>Status:
            <input name="status" type="number" value={form.status} onChange={handleChange} />
          </label>
          <label>Delay (ms):
            <input name="delay" type="number" value={form.delay} onChange={handleChange} />
          </label>
          <label>Error:
            <input name="error" type="checkbox" checked={form.error} onChange={handleChange} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 1 }}>Response (JSON or string):
            <textarea name="response" value={form.response} onChange={handleChange} rows={3} style={{ width: '100%' }} />
          </label>
        </div>
        <div className="form-row">
          <button type="submit">{editing ? 'Update Endpoint' : 'Add Endpoint'}</button>
          {editing && <button type="button" style={{ marginLeft: 10, background: '#64748b' }} onClick={() => { setEditing(false); setForm({ method: 'GET', path: '', response: '', status: 200, delay: 0, error: false }); }}>Cancel</button>}
        </div>
      </form>
      <h3>Defined Endpoints</h3>
      <ul className="endpoints-list">
        {endpoints.map((e, i) => (
          <li key={i}>
            <span style={{ cursor: 'pointer', textDecoration: 'underline', color: '#2563eb' }} onClick={() => {
              setForm({
                method: e.method,
                path: e.path,
                response: typeof e.response === 'string' ? e.response : JSON.stringify(e.response, null, 2),
                status: e.status,
                delay: e.delay,
                error: e.error
              });
              setEditing(true);
            }}>{e.method} <b>{e.path}</b></span> → Status: {e.status}, Delay: {e.delay}ms, Error: {e.error ? 'Yes' : 'No'}
            <button style={{ marginLeft: 12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }} onClick={() => handleDelete(e.method, e.path)}>Delete</button>
          </li>
        ))}
      </ul>
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Recent Logs
        <button style={{ background: '#f59e42', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 14px', cursor: 'pointer', fontSize: '0.95rem' }} onClick={handleClearLogs}>Clear Logs</button>
      </h3>
      <ul className="logs-list">
        {logs.map((log, i) => {
          let details;
          try {
            details = typeof log.body === 'string' ? JSON.parse(log.body) : log.body;
          } catch {
            details = log.body;
          }
          return (
            <li key={i}>
              <span style={{ color: '#888' }}>{log.timestamp}</span> <b>{log.method}</b> <span>{log.path}</span> <span style={{ color: '#555', fontSize: '0.95em' }}>{details?.userAgent}</span>
              <button style={{ marginLeft: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }} onClick={() => setSelectedLog({ ...log, details })}>View Details</button>
            </li>
          );
        })}
      </ul>
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4>Request Details</h4>
            <div><b>Timestamp:</b> {selectedLog.timestamp}</div>
            <div><b>Method:</b> {selectedLog.method}</div>
            <div><b>Path:</b> {selectedLog.path}</div>
            <div><b>IP:</b> {selectedLog.details?.ip}</div>
            <div><b>User-Agent:</b> {selectedLog.details?.userAgent}</div>
            <div><b>Query:</b> <pre>{JSON.stringify(selectedLog.details?.query, null, 2)}</pre></div>
            <div><b>Body:</b> <pre>{JSON.stringify(selectedLog.details?.body, null, 2)}</pre></div>
            <div><b>Headers:</b> <pre>{JSON.stringify(selectedLog.headers, null, 2)}</pre></div>
            <button style={{ marginTop: 10, background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer' }} onClick={() => setSelectedLog(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
// ...existing code...

}
export default App;
