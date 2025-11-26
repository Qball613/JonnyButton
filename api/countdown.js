// Serverless function with GitHub as backend
// Reads/writes to a Gist for persistence

const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function getState() {
  if (!GIST_ID || !GITHUB_TOKEN) {
    return { endTime: null, isActive: false };
  }
  
  try {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) return { endTime: null, isActive: false };
    
    const gist = await response.json();
    const content = gist.files['state.json'].content;
    return JSON.parse(content);
  } catch (error) {
    return { endTime: null, isActive: false };
  }
}

async function setState(state) {
  if (!GIST_ID || !GITHUB_TOKEN) return;
  
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'state.json': {
            content: JSON.stringify(state)
          }
        }
      })
    });
  } catch (error) {
    console.error('Error updating state:', error);
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const state = await getState();
    const now = Date.now();
    
    if (state.endTime && state.endTime > now) {
      return res.status(200).json({
        endTime: state.endTime,
        isActive: true,
        timeRemaining: state.endTime - now
      });
    } else {
      return res.status(200).json({
        endTime: null,
        isActive: false,
        timeRemaining: 0
      });
    }
  }

  if (req.method === 'POST') {
    const { action, endTime } = req.body;
    
    if (action === 'start') {
      let newState;
      
      if (!endTime || endTime <= Date.now()) {
        // Clear the countdown
        newState = {
          endTime: null,
          isActive: false
        };
      } else {
        newState = {
          endTime: endTime,
          isActive: true
        };
      }
      
      await setState(newState);
      
      return res.status(200).json({
        success: true,
        endTime: newState.endTime
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
