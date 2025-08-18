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

// API to get all endpoints
app.get('/api/endpoints', (req, res) => {
  const rows = db.prepare('SELECT method, path, response, status, delay, error FROM endpoints').all();
  // Parse response from string to object if possible
  rows.forEach(r => {
    try {
      r.response = JSON.parse(r.response);
    } catch {
      // leave as string
    }
    r.error = !!r.error;
  });
  res.json(rows);
});

// API to add/update an endpoint
app.post('/api/endpoints', (req, res) => {
  const { method, path, response, status = 200, delay = 0, error = false } = req.body;
  // Remove any existing endpoint with same method/path
  db.prepare('DELETE FROM endpoints WHERE method = ? AND path = ?').run(method, path);
  db.prepare('INSERT INTO endpoints (method, path, response, status, delay, error) VALUES (?, ?, ?, ?, ?, ?)')
    .run(method, path, typeof response === 'string' ? response : JSON.stringify(response), status, delay, error ? 1 : 0);
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
  const info = db.prepare('DELETE FROM endpoints WHERE method = ? AND path = ?').run(method, path);
  res.json({ success: info.changes > 0 });
});

// Catch-all for dynamic endpoints
app.all('*', (req, res) => {
  const endpoint = db.prepare('SELECT * FROM endpoints WHERE method = ? AND path = ?').get(req.method, req.path);
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
    if (endpoint.delay > 0) {
      setTimeout(() => {
        if (endpoint.error) {
          res.status(endpoint.status).json({ error: endpoint.response });
        } else {
          let resp;
          try {
            resp = JSON.parse(endpoint.response);
          } catch {
            resp = endpoint.response;
          }
          res.status(endpoint.status).json(resp);
        }
      }, endpoint.delay);
    } else {
      if (endpoint.error) {
        res.status(endpoint.status).json({ error: endpoint.response });
      } else {
        let resp;
        try {
          resp = JSON.parse(endpoint.response);
        } catch {
          resp = endpoint.response;
        }
        res.status(endpoint.status).json(resp);
      }
    }
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

app.listen(port, () => {
  console.log(`API Interceptor backend running at http://localhost:${port}`);
});
