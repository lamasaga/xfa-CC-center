const express = require('express');
const { getDb } = require('../db');
const metrics = require('../middleware/metrics');

const router = express.Router();

/** 负载均衡 / 运维探活，勿暴露敏感信息 */
router.get('/health', (req, res) => {
  const uptimeSeconds = Math.round(process.uptime() * 10) / 10;
  try {
    getDb().prepare('SELECT 1 AS ok').get();
    res.json({
      ok: true,
      uptime_seconds: uptimeSeconds,
      db: true,
      service: 'alevelinfo-api',
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      uptime_seconds: uptimeSeconds,
      db: false,
      service: 'alevelinfo-api',
      error: 'db_unavailable',
    });
  }
});

/**
 * 简单指标：需设置环境变量 METRICS_TOKEN；请求头携带 X-Metrics-Token: <token>
 * 或 Authorization: Bearer <token>（与 JWT 区分：此处为固定运维口令，勿与用户 JWT 混用）
 */
router.get('/metrics', (req, res) => {
  const token = process.env.METRICS_TOKEN ? String(process.env.METRICS_TOKEN).trim() : '';
  if (!token) {
    return res.status(404).json({ error: 'Metrics disabled (set METRICS_TOKEN)' });
  }

  const hdr = req.headers['x-metrics-token'] || '';
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (hdr !== token && bearer !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json(metrics.snapshot());
});

module.exports = router;
