import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import db from './db.js';

const app = express();
const port = 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: 'text/*' }));
app.use(bodyParser.raw({ type: 'application/octet-stream' }));

// Raw body middleware only for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

// Helper function to select response based on weights
function selectWeightedResponse(responses) {
  if (responses.length === 0) return null;
  if (responses.length === 1) return responses[0];
  
  const totalWeight = responses.reduce((sum, r) => sum + r.weight, 0);
  if (totalWeight === 0) return responses[Math.floor(Math.random() * responses.length)];
  
  const random = Math.random() * totalWeight;
  let currentWeight = 0;
  
  for (const response of responses) {
    currentWeight += response.weight;
    if (random <= currentWeight) {
      return response;
    }
  }
  
  return responses[responses.length - 1]; // fallback
}

// API to get all endpoints
app.get('/api/endpoints', (req, res) => {
  const rows = db.prepare('SELECT id, method, path, response, status, delay FROM endpoints').all();
  
  // Get weighted responses for each endpoint
  rows.forEach(row => {
    const weightedResponses = db.prepare('SELECT response, status, weight, delay FROM weighted_responses WHERE endpoint_id = ?').all(row.id);
    
    // Parse response from string to object if possible
    try {
      row.response = JSON.parse(row.response);
    } catch {
      // leave as string
    }
    
    // Parse weighted responses
    row.weightedResponses = weightedResponses.map(wr => {
      try {
        wr.response = JSON.parse(wr.response);
      } catch {
        // leave as string
      }
      return wr;
    });
  });
  
  res.json(rows);
});

// API to add/update an endpoint
app.post('/api/endpoints', (req, res) => {
  const { method, path, response, status = 200, delay = 0, weightedResponses = [] } = req.body;
  
  // Start transaction
  const transaction = db.transaction(() => {
    // Remove any existing endpoint with same method/path
    const existingEndpoint = db.prepare('SELECT id FROM endpoints WHERE method = ? AND path = ?').get(method, path);
    if (existingEndpoint) {
      db.prepare('DELETE FROM weighted_responses WHERE endpoint_id = ?').run(existingEndpoint.id);
      db.prepare('DELETE FROM endpoints WHERE id = ?').run(existingEndpoint.id);
    }
    
    // Insert new endpoint
    const result = db.prepare('INSERT INTO endpoints (method, path, response, status, delay) VALUES (?, ?, ?, ?, ?)')
      .run(method, path, typeof response === 'string' ? response : JSON.stringify(response), status, delay);
    
    const endpointId = result.lastInsertRowid;
    
    // Insert weighted responses if provided
    if (weightedResponses && weightedResponses.length > 0) {
      const insertWeightedResponse = db.prepare('INSERT INTO weighted_responses (endpoint_id, response, status, weight, delay) VALUES (?, ?, ?, ?, ?)');
      
      for (const wr of weightedResponses) {
        insertWeightedResponse.run(
          endpointId,
          typeof wr.response === 'string' ? wr.response : JSON.stringify(wr.response),
          wr.status || 200,
          wr.weight || 1,
          wr.delay || 0
        );
      }
    }
  });
  
  transaction();
  res.json({ success: true });
});

// API to get logs
app.get('/api/logs', (req, res) => {
  const rows = db.prepare('SELECT timestamp, method, path, body, headers FROM logs ORDER BY id DESC LIMIT 20').all();
  rows.forEach(r => {
    try {
      r.body = JSON.parse(r.body);
    } catch {
      // leave as string
    }
    try {
      r.headers = JSON.parse(r.headers);
    } catch {
      // leave as string
    }
  });
  res.json(rows);
});

// API to clear logs
app.delete('/api/logs', (req, res) => {
  db.prepare('DELETE FROM logs').run();
  res.json({ success: true });
});

// API to delete an endpoint
app.delete('/api/endpoints', (req, res) => {
  const { method, path } = req.body;
  
  // Start transaction to delete endpoint and its weighted responses
  const transaction = db.transaction(() => {
    const endpoint = db.prepare('SELECT id FROM endpoints WHERE method = ? AND path = ?').get(method, path);
    if (endpoint) {
      db.prepare('DELETE FROM weighted_responses WHERE endpoint_id = ?').run(endpoint.id);
      const info = db.prepare('DELETE FROM endpoints WHERE id = ?').run(endpoint.id);
      return info.changes > 0;
    }
    return false;
  });
  
  const success = transaction();
  res.json({ success });
});

// Catch-all for dynamic endpoints
app.all('*', (req, res) => {
  const endpoint = db.prepare('SELECT id, method, path, response, status, delay FROM endpoints WHERE method = ? AND path = ?').get(req.method, req.path);
  if (endpoint) {
    console.log(endpoint.path);
  }

  // Format timestamp as YYYY-MM-DD HH:mm:ss
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  // Parse body if possible
  let parsedBody = undefined;
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    parsedBody = req.body;
  } else if (req.rawBody && req.rawBody.length > 0) {
    try {
      parsedBody = JSON.parse(req.rawBody);
    } catch {
      parsedBody = req.rawBody;
    }
  }

  // Log info
  const logInfo = {
    timestamp,
    method: req.method,
    path: req.path,
    body: parsedBody,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    headers: req.headers
  };

  db.prepare('INSERT INTO logs (timestamp, method, path, body, headers) VALUES (?, ?, ?, ?, ?)')
    .run(
      logInfo.timestamp,
      logInfo.method,
      logInfo.path,
      JSON.stringify({ body: logInfo.body, query: logInfo.query, ip: logInfo.ip, userAgent: logInfo.userAgent }),
      JSON.stringify(logInfo.headers)
    );

  if (endpoint) {
    // Check for weighted responses first
    const weightedResponses = db.prepare('SELECT response, status, weight, delay FROM weighted_responses WHERE endpoint_id = ?').all(endpoint.id);
    
    let selectedResponse;
    if (weightedResponses.length > 0) {
      selectedResponse = selectWeightedResponse(weightedResponses);
    } else {
      // Use the default endpoint response
      selectedResponse = {
        response: endpoint.response,
        status: endpoint.status,
        delay: endpoint.delay
      };
    }
    
    const handleResponse = () => {
      let resp;
      try {
        resp = JSON.parse(selectedResponse.response);
      } catch {
        resp = selectedResponse.response;
      }
      res.status(selectedResponse.status).json(resp);
    };
    
    const delay = selectedResponse.delay || 0;
    if (delay > 0) {
      setTimeout(handleResponse, delay);
    } else {
      handleResponse();
    }
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

app.listen(port, () => {
  console.log(`API Interceptor backend running at http://localhost:${port}`);
});
