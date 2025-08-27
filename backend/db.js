import Database from 'better-sqlite3';

const db = new Database('api-interceptor.sqlite');

// Create tables if they don't exist
// Endpoints table
// id, method, path, response, status, delay, error
// Logs table
// id, timestamp, method, path, body, headers

db.exec(`
CREATE TABLE IF NOT EXISTS endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT,
  path TEXT,
  response TEXT,
  status INTEGER,
  delay INTEGER,
  error INTEGER
);
CREATE TABLE IF NOT EXISTS weighted_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER,
  response TEXT,
  status INTEGER,
  weight INTEGER,
  delay INTEGER,
  error INTEGER,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints (id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  method TEXT,
  path TEXT,
  body TEXT,
  headers TEXT
);
`);

export default db;
