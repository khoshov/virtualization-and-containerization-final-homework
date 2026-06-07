const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure DB connection pool
const pool = new Pool({
  connectionString: databaseUrl,
});

// Helper function to initialize database tables
async function initDb() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log('Connecting to PostgreSQL database...');
      // Test connection
      await pool.query('SELECT NOW()');
      
      // Create tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS page_views (
          id SERIAL PRIMARY KEY,
          viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS guestbook (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('Database tables initialized successfully.');
      break;
    } catch (err) {
      console.error('Database connection failed. Retrying in 2 seconds...', err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 2000));
    }
  }
}

// Route to get application statistics
app.get('/api/stats', async (req, res) => {
  try {
    // Insert a view record
    await pool.query('INSERT INTO page_views DEFAULT VALUES');
    
    // Get total views
    const viewsResult = await pool.query('SELECT COUNT(*) FROM page_views');
    const totalViews = parseInt(viewsResult.rows[0].count, 10);
    
    // Get database time to prove active DB connection
    const timeResult = await pool.query('SELECT NOW()');
    const dbTime = timeResult.rows[0].now;

    res.json({
      status: 'success',
      dbConnected: true,
      totalViews,
      dbTime,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        osRelease: require('os').release(),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 'error',
      dbConnected: false,
      message: err.message
    });
  }
});

// Route to get guestbook messages
app.get('/api/guestbook', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM guestbook ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Route to post a new guestbook message
app.post('/api/guestbook', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO guestbook (name, message) VALUES ($1, $2) RETURNING *',
      [name, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Database connection error');
  }
});

// Serve frontend dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server after DB initialization
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Application is running on port ${port}`);
  });
});
