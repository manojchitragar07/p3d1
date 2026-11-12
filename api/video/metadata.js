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

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(VIDEO_METADATA, null, 2));
}

