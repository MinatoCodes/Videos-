const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const port = process.env.PORT || 3000;

// Metadata
const metadata = {
  author: 'MinatoCodes',
  version: '1.0.0'
};

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = 'MinatoCodes
const GITHUB_REPO = 'Videos-';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'video';

// Enable CORS for global access
app.use(cors());

// Rate limiting: max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/host', limiter);

// Middleware to parse JSON bodies
app.use(express.json());

// Validate video URL
function isValidVideoUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    return videoExtensions.some(ext => parsedUrl.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

// Endpoint to host video URL
app.get('/host', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    if (!isValidVideoUrl(url)) {
      return res.status(400).json({ error: 'Invalid video URL. Must be a valid video file (e.g., .mp4, .mkv, .mov)' });
    }

    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'GitHub token not configured' });
    }

    // Fetch current videos.json from GitHub
    let videos = [];
    let sha;
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
        {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      videos = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf-8'));
      sha = response.data.sha;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // File doesn't exist, initialize empty array
        videos = [];
      } else {
        throw error;
      }
    }

    // Add new video URL with metadata
    const newVideo = {
      id: videos.length + 1,
      url,
      timestamp: new Date().toISOString(),
      region: req.headers['x-forwarded-for'] || req.ip || 'unknown',
      author: metadata.author
    };
    videos.push(newVideo);

    // Update videos.json in GitHub
    await axios.put(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
      {
        message: `Add video URL ${url} by ${metadata.author}`,
        content: Buffer.from(JSON.stringify(videos, null, 2)).toString('base64'),
        branch: GITHUB_BRANCH,
        sha: sha // Include SHA if file exists
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    // Return hosted URL
    const hostedUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}`;
    res.status(200).json({
      message: 'Video URL hosted successfully',
      video: newVideo,
      hostedUrl,
      author: metadata.author
    });
  } catch (error) {
    console.error('Error hosting video URL:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to host video URL' });
  }
});

// Root endpoint for UptimeRobot pings
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Video Host API is running', author: metadata.author });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
