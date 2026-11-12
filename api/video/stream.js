import fs from 'node:fs';
import path from 'node:path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // On Vercel, redirecting to the static asset lets Vercel's Edge CDN serve with native HTTP 206 range requests
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  
  // Try direct streaming if file is accessible in serverless bundle
  const candidates = [
    path.join(process.cwd(), 'gemini_generated_video_b8e50077.mp4'),
    path.join(process.cwd(), 'frontend', 'gemini_generated_video_b8e50077.mp4'),
    path.join(process.cwd(), 'backend', 'media', 'gemini_generated_video_b8e50077.mp4')
  ];

  let mediaPath = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      mediaPath = c;
      break;
    }
  }

  if (!mediaPath) {
    // If not found in serverless bundle, redirect to static asset URL
    res.writeHead(302, { Location: '/gemini_generated_video_b8e50077.mp4' });
    return res.end();
  }

  const stats = fs.statSync(mediaPath);
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
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600'
    });

    fs.createReadStream(mediaPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });

    fs.createReadStream(mediaPath).pipe(res);
  }
}

