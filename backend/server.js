import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5001;

// Resolve Media File across multiple environments (Local, Vercel Serverless, Docker)
function getMediaPath() {
  const candidates = [
    path.join(__dirname, 'media', 'gemini_generated_video_b8e50077.mp4'),
    path.join(process.cwd(), 'backend', 'media', 'gemini_generated_video_b8e50077.mp4'),
    path.join(process.cwd(), 'frontend', 'gemini_generated_video_b8e50077.mp4'),
    path.join(__dirname, '..', 'frontend', 'gemini_generated_video_b8e50077.mp4'),
    path.join(process.cwd(), 'gemini_generated_video_b8e50077.mp4')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

// Resolve Frontend Directory for static fallback
function getFrontendDir() {
  const candidates = [
    path.join(__dirname, '..', 'frontend'),
    path.join(process.cwd(), 'frontend'),
    path.join(__dirname, 'frontend'),
    process.cwd()
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return candidates[0];
}

// In-Memory Inquiries fallback for Serverless read-only filesystems
const inMemoryInquiries = [];
const DATA_DIR = path.join(__dirname, 'data');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(INQUIRIES_FILE)) {
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify([], null, 2));
  } else {
    const raw = fs.readFileSync(INQUIRIES_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) inMemoryInquiries.push(...parsed);
  }
} catch {
  // Read-only filesystem (e.g. Vercel) - keep in memory
}

// Video Metadata Specification
const VIDEO_METADATA = {
  assetId: 'gemini_generated_video_b8e50077',
  filename: 'gemini_generated_video_b8e50077.mp4',
  duration: 10.027,
  fps: 24.0,
  totalFrames: 240,
  resolution: {
    width: 1280,
    height: 720,
    aspectRatio: '16:9'
  },
  codecs: {
    video: 'H.264 (High Profile)',
    audio: 'MPEG-4 AAC'
  },
  bitrate: {
    video: '2,811 kbps',
    audio: '128 kbps',
    total: '2,939 kbps'
  },
  provenance: {
    generator: 'Google Generative Media Core',
    watermark: 'SynthID Embedded Verification',
    c2pa: true
  },
  chapters: [
    { id: 0, title: 'GENESIS', start: 0.00, end: 0.20, time: 0.0, label: 'Stage 01 // Silhouette Reveal' },
    { id: 1, title: 'GEOMETRY', start: 0.20, end: 0.42, time: 2.0, label: 'Stage 02 // Continuous Curvature' },
    { id: 2, title: 'DYNAMICS', start: 0.42, end: 0.68, time: 4.5, label: 'Stage 03 // 180° Kinematic Sweep' },
    { id: 3, title: 'CORE ARCH', start: 0.68, end: 0.88, time: 7.0, label: 'Stage 04 // Internal Cellular Matrix' },
    { id: 4, title: 'SPECIFICATION', start: 0.88, end: 1.00, time: 9.0, label: 'Stage 05 // Climax & Acquisition' }
  ]
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

// Set CORS Headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
}

// Stream video with RFC 7233 byte-range support (HTTP 206 Partial Content)
function handleVideoStream(req, res) {
  const mediaPath = getMediaPath();
  fs.stat(mediaPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Video file not found on server' }));
    }

    const totalSize = stats.size;
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        return res.end();
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(mediaPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600'
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });

      fs.createReadStream(mediaPath).pipe(res);
    }
  });
}

// Serve Static Frontend File with Range support
function handleStaticFile(req, res, urlPath) {
  const frontendDir = getFrontendDir();
  let safePath = path.normalize(decodeURI(urlPath)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(frontendDir, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: If not found, serve index.html for SPA routing or 404
      const indexPath = path.join(frontendDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        return res.end();
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });

      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// Main HTTP Request Handler (compatible with Standalone & Vercel Serverless)
export function appHandler(req, res) {
  setCorsHeaders(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = req.url.split('?')[0];

  // 1. Health Endpoint
  if (urlPath === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'healthy',
      service: 'p3d-backend-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  }

  // 2. Video Stream Endpoint
  if (urlPath === '/api/video/stream' && req.method === 'GET') {
    return handleVideoStream(req, res);
  }

  // 3. Video Metadata Endpoint
  if (urlPath === '/api/video/metadata' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(VIDEO_METADATA, null, 2));
  }

  // 4. Pre-Order Inquiries (POST & GET)
  if (urlPath === '/api/inquiries') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const allocationId = 'ALLOC-' + Math.random().toString(36).substring(2, 9).toUpperCase();
          const record = {
            id: allocationId,
            name: payload.name || 'Anonymous',
            email: payload.email || 'N/A',
            profile: payload.profile || 'General Validation',
            timestamp: new Date().toISOString(),
            status: 'CONFIRMED_BATCH_01'
          };

          inMemoryInquiries.unshift(record);

          // Try saving to disk, ignore if in read-only serverless environment
          try {
            fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inMemoryInquiries, null, 2));
          } catch {}

          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            allocationId: record.id,
            status: record.status,
            message: 'Reservation recorded. Priority confirmation registered.'
          }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    } else if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(inMemoryInquiries, null, 2));
    }
  }

  // 5. If route does not match an API endpoint, serve the Frontend landing page & assets!
  // This completely prevents the "Endpoint not found" error when deployed on Vercel!
  if (!urlPath.startsWith('/api/')) {
    return handleStaticFile(req, res, urlPath);
  }

  // Fallback 404 for unknown /api/ routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET  /api/health',
      'GET  /api/video/stream',
      'GET  /api/video/metadata',
      'POST /api/inquiries',
      'GET  /api/inquiries'
    ]
  }));
}

const server = http.createServer(appHandler);

// Start standalone HTTP server only when run directly (not in Vercel serverless execution)
if (process.env.VERCEL !== '1') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`🔥 PROJECT 3D // BACKEND API SERVER`);
    console.log(`   ➜ Stream:   http://localhost:${PORT}/api/video/stream`);
    console.log(`   ➜ Metadata: http://localhost:${PORT}/api/video/metadata`);
    console.log(`   ➜ Health:   http://localhost:${PORT}/api/health`);
    console.log(`========================================\n`);
  });
}

export default appHandler;
