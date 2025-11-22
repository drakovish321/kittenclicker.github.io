const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const USER_DATA_FILE = path.join(DATA_DIR, 'user_data.json');

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// In-memory storage for user data
// Each user will have { lastUpdated: timestamp, playerCount: number, ...otherData }
const userData = new Map();

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Save user data to file
async function saveUserData() {
  try {
    const data = JSON.stringify([...userData.entries()], null, 2);
    await fs.writeFile(USER_DATA_FILE, data);
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

// Load user data from file
async function loadUserData() {
  try {
    const data = await fs.readFile(USER_DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    userData.clear();
    parsed.forEach(([id, user]) => userData.set(id, user));
    console.log(`Loaded ${userData.size} users from file`);
  } catch (error) {
    console.log('No existing user data file found, starting fresh');
  }
}

// Endpoint to save/update user data
app.post('/userlist', async (req, res) => {
  try {
    const { userId, playerCount, ...otherData } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    userData.set(userId, {
      playerCount: typeof playerCount === 'number' ? playerCount : 0,
      lastUpdated: Date.now(),
      ...otherData
    });

    await saveUserData();
    res.json({ success: true, message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Endpoint to get global player counts
app.get('/player-count', (req, res) => {
  let current = 0;
  let total = 0;

  userData.forEach(user => {
    if (user.playerCount && typeof user.playerCount === 'number') {
      current += user.playerCount;
      total += user.playerCount; // Could also track total separately if needed
    }
  });

  res.json({ current, total });
});

// SSE endpoint for real-time updates
app.get('/player-count-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Function to send current counts
  const sendCounts = () => {
    let current = 0;
    let total = 0;

    userData.forEach(user => {
      if (user.playerCount && typeof user.playerCount === 'number') {
        current += user.playerCount;
        total += user.playerCount;
      }
    });

    res.write(`data: ${JSON.stringify({ current, total })}\n\n`);
  };

  // Send initial data
  sendCounts();

  // Update every 5 seconds
  const interval = setInterval(sendCounts, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// FangDootle Browser route
app.get('/fangdootle', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'fangdootle.html'));
});

// Serve main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'main.html'));
});

// Initialize server
async function init() {
  await ensureDataDir();
  await loadUserData();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

init().catch(console.error);
