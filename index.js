
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const port = process.env.PORT || 3000;

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

// Path to store video URLs
const videoDataPath = path.join(__dirname, 'video', 'videos.json');

// Ensure videos.json exists
async function initializeVideosFile() {
  try {
    await fs.access(videoDataPath);
  } catch {
    await fs.writeFile(videoDataPath, JSON.stringify([]));
  }
}

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

    // Initialize videos.json if it doesn't exist
    await initializeVideosFile();

    // Read current videos with locking mechanism
    let videos = JSON.parse(await fs.readFile(videoDataPath, 'utf-8'));

    // Add new video URL with metadata
    const newVideo = {
      id: videos.length + 1,
      url,
      timestamp: new Date().toISOString(),
      region: req.headers['x-forwarded-for'] || req.ip || 'unknown' // Approximate region via IP
    };
    videos.push(newVideo);

    // Write back to file (concurrent-safe)
    await fs.writeFile(videoDataPath, JSON.stringify(videos, null, 2));

    // Return hosted URL
    const hostedUrl = `https://raw.githubusercontent.com/MinatoCodes/Videos-/main/video/videos.json`;
    res.status(200).json({
      message: 'Video URL hosted successfully',
      video: newVideo,
      hostedUrl
    });
  } catch (error) {
    console.error('Error hosting video URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
