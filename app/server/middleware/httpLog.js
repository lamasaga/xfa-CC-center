const metrics = require('./metrics');

const SLOW_MS_DEFAULT = Number.parseInt(String(process.env.HTTP_LOG_SLOW_MS || '800'), 10) || 800;

/**
 * 单行 JSON 日志 + 慢请求计数。日志可被 journald / Docker 收集后按 JSON 解析。
 */
function httpLog(options = {}) {
  const slowMs = Number.isFinite(options.slowMs) ? options.slowMs : SLOW_MS_DEFAULT;

  return function httpLogMiddleware(req, res, next) {
    const t0 = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - t0;
      try {
        metrics.record(req, res, durationMs, { slowMs });
      } catch {
        // ignore metrics errors
      }

      const path = String(req.originalUrl || req.url || '').split('?')[0];
      const row = {
        ts: new Date().toISOString(),
        level: durationMs >= slowMs ? 'warn' : 'info',
        msg: 'http_request',
        method: req.method,
        path,
        status: res.statusCode,
        duration_ms: durationMs,
        ip: req.ip || req.socket?.remoteAddress || '',
      };
      if (durationMs >= slowMs) {
        row.slow = true;
      }
      console.log(JSON.stringify(row));
    });
    next();
  };
}

module.exports = { httpLog };
