import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [endpoints, setEndpoints] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ method: 'GET', path: '', response: '', status: 200, delay: 0, error: false });
  const [weightedResponses, setWeightedResponses] = useState([]);
  const [editing, setEditing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showWeightedResponses, setShowWeightedResponses] = useState(false);
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'weighted'

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
    
    const payload = { 
      ...form, 
      response,
      weightedResponses: activeTab === 'weighted' ? weightedResponses : []
    };
    
    await axios.post('http://localhost:4000/api/endpoints', payload);
    fetchEndpoints();
    setEditing(false);
    setForm({ method: 'GET', path: '', response: '', status: 200, delay: 0, error: false });
    setWeightedResponses([]);
    setActiveTab('single');
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

  const addWeightedResponse = () => {
    setWeightedResponses([...weightedResponses, { response: '', status: 200, weight: 1, delay: 0, error: false }]);
  };

  const removeWeightedResponse = (index) => {
    setWeightedResponses(weightedResponses.filter((_, i) => i !== index));
  };

  const updateWeightedResponse = (index, field, value) => {
    const updated = [...weightedResponses];
    updated[index][field] = field === 'weight' || field === 'status' || field === 'delay' ? parseInt(value) || 0 : 
                            field === 'error' ? value : value;
    setWeightedResponses(updated);
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
        </div>
        
        {/* Tab Navigation */}
        <div className="tab-navigation" style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'single' ? 'active' : ''}`}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'single' ? '#2563eb' : '#f3f4f6',
              color: activeTab === 'single' ? '#fff' : '#374151',
              cursor: 'pointer',
              marginRight: '2px',
              borderRadius: '4px 4px 0 0'
            }}
            onClick={() => setActiveTab('single')}
          >
            Single Response
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'weighted' ? 'active' : ''}`}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === 'weighted' ? '#2563eb' : '#f3f4f6',
              color: activeTab === 'weighted' ? '#fff' : '#374151',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
            onClick={() => setActiveTab('weighted')}
          >
            Weighted Responses
          </button>
        </div>

        {/* Single Response Tab */}
        {activeTab === 'single' && (
          <div className="single-response-tab">
            <div className="form-row">
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
          </div>
        )}

        {/* Weighted Responses Tab */}
        {activeTab === 'weighted' && (
          <div className="weighted-responses-tab">
            <p style={{ fontSize: '0.9em', color: '#666', margin: '0 0 15px 0' }}>
              Define multiple responses with weights to control their probability of being returned.
            </p>
            {weightedResponses.map((wr, index) => (
              <div key={index} className="weighted-response-item" style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px', borderRadius: '6px', background: '#f9fafb' }}>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <label>Status:
                    <input 
                      type="number" 
                      value={wr.status} 
                      onChange={(e) => updateWeightedResponse(index, 'status', e.target.value)}
                      style={{ width: '80px' }}
                    />
                  </label>
                  <label>Weight:
                    <input 
                      type="number" 
                      value={wr.weight} 
                      onChange={(e) => updateWeightedResponse(index, 'weight', e.target.value)}
                      style={{ width: '80px' }}
                      min="1"
                    />
                  </label>
                  <label>Delay (ms):
                    <input 
                      type="number" 
                      value={wr.delay} 
                      onChange={(e) => updateWeightedResponse(index, 'delay', e.target.value)}
                      style={{ width: '100px' }}
                      min="0"
                    />
                  </label>
                  <label>Error:
                    <input 
                      type="checkbox" 
                      checked={wr.error} 
                      onChange={(e) => updateWeightedResponse(index, 'error', e.target.checked)}
                    />
                  </label>
                  <button 
                    type="button" 
                    onClick={() => removeWeightedResponse(index)}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', height: 'fit-content' }}
                  >
                    Remove
                  </button>
                </div>
                <label>Response (JSON or string):
                  <textarea 
                    value={wr.response} 
                    onChange={(e) => updateWeightedResponse(index, 'response', e.target.value)}
                    rows={3} 
                    style={{ width: '100%', marginTop: '5px' }}
                  />
                </label>
              </div>
            ))}
            <button 
              type="button" 
              onClick={addWeightedResponse}
              style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 20px', marginBottom: '15px' }}
            >
              Add Weighted Response
            </button>
            {weightedResponses.length === 0 && (
              <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                No weighted responses defined. Click "Add Weighted Response" to get started.
              </p>
            )}
          </div>
        )}
        <div className="form-row">
          <button type="submit">{editing ? 'Update Endpoint' : 'Add Endpoint'}</button>
          {editing && <button type="button" style={{ marginLeft: 10, background: '#64748b' }} onClick={() => { 
            setEditing(false); 
            setForm({ method: 'GET', path: '', response: '', status: 200, delay: 0, error: false }); 
            setWeightedResponses([]);
            setActiveTab('single');
          }}>Cancel</button>}
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
              
              // Set up weighted responses if they exist
              if (e.weightedResponses && e.weightedResponses.length > 0) {
                setWeightedResponses(e.weightedResponses.map(wr => ({
                  response: typeof wr.response === 'string' ? wr.response : JSON.stringify(wr.response, null, 2),
                  status: wr.status,
                  weight: wr.weight,
                  delay: wr.delay || 0,
                  error: wr.error
                })));
                setActiveTab('weighted');
              } else {
                setWeightedResponses([]);
                setActiveTab('single');
              }
              
              setEditing(true);
            }}>{e.method} <b>{e.path}</b></span> → Status: {e.status}, Delay: {e.delay}ms, Error: {e.error ? 'Yes' : 'No'}
            {e.weightedResponses && e.weightedResponses.length > 0 && (
              <span style={{ marginLeft: 8, padding: '2px 6px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '4px', fontSize: '0.8em' }}>
                {e.weightedResponses.length} weighted responses
              </span>
            )}
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
