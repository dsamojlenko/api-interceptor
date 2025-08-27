import Database from 'better-sqlite3';

const db = new Database('api-interceptor.sqlite');

// Enable foreign key constraints
db.exec('PRAGMA foreign_keys = ON');

// Migration: Remove error columns if they exist
try {
  // Check if error column exists in endpoints table
  const endpointsColumns = db.prepare("PRAGMA table_info(endpoints)").all();
  const hasEndpointError = endpointsColumns.some(col => col.name === 'error');
  
  if (hasEndpointError) {
    console.log('Migrating endpoints table to remove error column...');
    db.exec(`
      CREATE TABLE endpoints_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT,
        path TEXT,
        response TEXT,
        status INTEGER,
        delay INTEGER
      );
      INSERT INTO endpoints_new (id, method, path, response, status, delay)
      SELECT id, method, path, response, status, delay FROM endpoints;
      DROP TABLE endpoints;
      ALTER TABLE endpoints_new RENAME TO endpoints;
    `);
  }
  
  // Check if error column exists in weighted_responses table
  const weightedColumns = db.prepare("PRAGMA table_info(weighted_responses)").all();
  const hasWeightedError = weightedColumns.some(col => col.name === 'error');
  
  if (hasWeightedError) {
    console.log('Migrating weighted_responses table to remove error column...');
    db.exec(`
      CREATE TABLE weighted_responses_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_id INTEGER,
        response TEXT,
        status INTEGER,
        weight INTEGER,
        delay INTEGER,
        FOREIGN KEY (endpoint_id) REFERENCES endpoints (id) ON DELETE CASCADE
      );
      INSERT INTO weighted_responses_new (id, endpoint_id, response, status, weight, delay)
      SELECT id, endpoint_id, response, status, weight, delay FROM weighted_responses;
      DROP TABLE weighted_responses;
      ALTER TABLE weighted_responses_new RENAME TO weighted_responses;
    `);
  }
} catch (error) {
  console.log('Migration completed or not needed:', error.message);
}

// Create tables if they don't exist (for new installations)
db.exec(`
CREATE TABLE IF NOT EXISTS endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT,
  path TEXT,
  response TEXT,
  status INTEGER,
  delay INTEGER
);
CREATE TABLE IF NOT EXISTS weighted_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER,
  response TEXT,
  status INTEGER,
  weight INTEGER,
  delay INTEGER,
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
