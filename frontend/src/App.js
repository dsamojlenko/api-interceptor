import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [endpoints, setEndpoints] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ method: 'GET', path: '', response: '', status: 200, delay: 0 });
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
    setForm({ method: 'GET', path: '', response: '', status: 200, delay: 0 });
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
    setWeightedResponses([...weightedResponses, { response: '', status: 200, weight: 1, delay: 0 }]);
  };

  const removeWeightedResponse = (index) => {
    setWeightedResponses(weightedResponses.filter((_, i) => i !== index));
  };

  const updateWeightedResponse = (index, field, value) => {
    const updated = [...weightedResponses];
    updated[index][field] = field === 'weight' || field === 'status' || field === 'delay' ? parseInt(value) || 0 : value;
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
          <label className="form-label method">
            <span className="form-label-text">Method:</span>
            <select 
              name="method" 
              value={form.method} 
              onChange={handleChange}
              className="form-select"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>
          </label>
          <label className="form-label path">
            <span className="form-label-text">Path:</span>
            <input 
              name="path" 
              value={form.path} 
              onChange={handleChange} 
              placeholder="/api/test" 
              required 
              className="form-input"
            />
          </label>
        </div>
        
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            type="button"
            className={`tab-button ${activeTab === 'single' ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab('single')}
          >
            Single Response
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'weighted' ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab('weighted')}
          >
            Weighted Responses
          </button>
        </div>

        {/* Single Response Tab */}
        {activeTab === 'single' && (
          <div className="single-response-tab">
            <div className="form-row">
              <label className="form-label status">
                <span className="form-label-text">Status:</span>
                <input 
                  name="status" 
                  type="number" 
                  value={form.status} 
                  onChange={handleChange} 
                  className="form-input"
                />
              </label>
              <label className="form-label delay">
                <span className="form-label-text">Delay (ms):</span>
                <input 
                  name="delay" 
                  type="number" 
                  value={form.delay} 
                  onChange={handleChange} 
                  className="form-input"
                />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label full-width">
                <span className="form-label-text">Response (JSON or string):</span>
                <textarea 
                  name="response" 
                  value={form.response} 
                  onChange={handleChange} 
                  rows={4} 
                  className="form-textarea single-response"
                />
              </label>
            </div>
          </div>
        )}

        {/* Weighted Responses Tab */}
        {activeTab === 'weighted' && (
          <div className="weighted-responses-tab">
            <p className="weighted-responses-description">
              Define multiple responses with weights to control their probability of being returned.
            </p>
            {weightedResponses.map((wr, index) => (
              <div key={index} className="weighted-response-item">
                <div className="weighted-response-controls">
                  <label className="form-label">
                    <span className="form-label-text">Status:</span>
                    <input 
                      type="number" 
                      value={wr.status} 
                      onChange={(e) => updateWeightedResponse(index, 'status', e.target.value)}
                      className="form-input"
                    />
                  </label>
                  <label className="form-label">
                    <span className="form-label-text">Weight:</span>
                    <input 
                      type="number" 
                      value={wr.weight} 
                      onChange={(e) => updateWeightedResponse(index, 'weight', e.target.value)}
                      min="1"
                      className="form-input"
                    />
                  </label>
                  <label className="form-label delay">
                    <span className="form-label-text">Delay (ms):</span>
                    <input 
                      type="number" 
                      value={wr.delay} 
                      onChange={(e) => updateWeightedResponse(index, 'delay', e.target.value)}
                      min="0"
                      className="form-input"
                    />
                  </label>
                  <button 
                    type="button" 
                    onClick={() => removeWeightedResponse(index)}
                    className="btn danger"
                  >
                    Remove
                  </button>
                </div>
                <label className="form-label full-width">
                  <span className="form-label-text">Response (JSON or string):</span>
                  <textarea 
                    value={wr.response} 
                    onChange={(e) => updateWeightedResponse(index, 'response', e.target.value)}
                    rows={4} 
                    className="form-textarea weighted-response"
                  />
                </label>
              </div>
            ))}
            <button 
              type="button" 
              onClick={addWeightedResponse}
              className="btn success"
            >
              Add Weighted Response
            </button>
            {weightedResponses.length === 0 && (
              <div className="empty-state">
                No weighted responses defined. Click "Add Weighted Response" to get started.
              </div>
            )}
          </div>
        )}
        <div className="form-row submit-buttons">
          <button 
            type="submit"
            className="btn primary"
          >
            {editing ? 'Update Endpoint' : 'Add Endpoint'}
          </button>
          {editing && (
            <button 
              type="button" 
              className="btn secondary"
              onClick={() => { 
                setEditing(false); 
                setForm({ method: 'GET', path: '', response: '', status: 200, delay: 0 }); 
                setWeightedResponses([]);
                setActiveTab('single');
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <h3>Defined Endpoints</h3>
      <div className="endpoints-list">
        {endpoints.length === 0 ? (
          <div className="empty-state endpoints">
            No endpoints defined yet. Create your first endpoint above.
          </div>
        ) : (
          endpoints.map((e, i) => (
            <div key={i} className="endpoint-card">
              <div className="endpoint-header">
                <div className="endpoint-info">
                  <span className={`method-badge ${e.method.toLowerCase()}`}>
                    {e.method}
                  </span>
                  <span 
                    className="endpoint-path"
                    onClick={() => {
                      setForm({
                        method: e.method,
                        path: e.path,
                        response: typeof e.response === 'string' ? e.response : JSON.stringify(e.response, null, 2),
                        status: e.status,
                        delay: e.delay
                      });
                      
                      // Set up weighted responses if they exist
                      if (e.weightedResponses && e.weightedResponses.length > 0) {
                        setWeightedResponses(e.weightedResponses.map(wr => ({
                          response: typeof wr.response === 'string' ? wr.response : JSON.stringify(wr.response, null, 2),
                          status: wr.status,
                          weight: wr.weight,
                          delay: wr.delay || 0
                        })));
                        setActiveTab('weighted');
                      } else {
                        setWeightedResponses([]);
                        setActiveTab('single');
                      }
                      
                      setEditing(true);
                    }}
                  >
                    {e.path}
                  </span>
                </div>
                <button 
                  className="btn danger small"
                  onClick={() => handleDelete(e.method, e.path)}
                >
                  Delete
                </button>
              </div>
              
              <div className="endpoint-tags">
                {e.weightedResponses && e.weightedResponses.length > 0 ? (
                  // For weighted responses, show summary information
                  <>
                    <span className="tag status">
                      Status: {e.weightedResponses.map(wr => wr.status).join(', ')}
                    </span>
                    <span className="tag status">
                      Delays: {e.weightedResponses.map(wr => `${wr.delay}ms`).join(', ')}
                    </span>
                  </>
                ) : (
                  // For single response, show the single values
                  <>
                    <span className="tag status">
                      Status: {e.status}
                    </span>
                    <span className="tag status">
                      Delay: {e.delay}ms
                    </span>
                  </>
                )}
                {e.weightedResponses && e.weightedResponses.length > 0 ? (
                  // For weighted responses, analyze the mix of status codes
                  (() => {
                    const successCount = e.weightedResponses.filter(wr => wr.status < 400).length;
                    const errorCount = e.weightedResponses.filter(wr => wr.status >= 400).length;
                    
                    if (successCount > 0 && errorCount > 0) {
                      return <span className="tag mixed">Mixed Responses</span>;
                    } else if (errorCount > 0) {
                      return <span className="tag error">Error Responses</span>;
                    } else {
                      return <span className="tag success">Success Responses</span>;
                    }
                  })()
                ) : (
                  // For single response, use the single response status
                  <span className={`tag ${e.status >= 400 ? 'error' : 'success'}`}>
                    {e.status >= 400 ? 'Error Response' : 'Success Response'}
                  </span>
                )}
                {e.weightedResponses && e.weightedResponses.length > 0 && (
                  <span className="tag weighted">
                    {e.weightedResponses.length} weighted responses
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <h3 className="logs-header">
        Recent Logs
        <button className="btn warning" onClick={handleClearLogs}>Clear Logs</button>
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
              <span className="log-timestamp">{log.timestamp}</span> <b className="log-method">{log.method}</b> <span>{log.path}</span> <span className="log-user-agent">{details?.userAgent}</span>
              <button className="btn info" onClick={() => setSelectedLog({ ...log, details })}>View Details</button>
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
            <button className="btn close" onClick={() => setSelectedLog(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
// ...existing code...

}
export default App;
