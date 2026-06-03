/**
 * 进程内轻量指标（重启清零）。用于粗看 QPS 分布与总请求量，非 Prometheus 级方案。
 */

const startedAt = Date.now();

const state = {
  total: 0,
  /** @type {Record<string, number>} */
  byKey: {},
  slowTotal: 0,
};

function simplifiedPath(url) {
  const p = String(url || '').split('?')[0];
  return p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .slice(0, 160);
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} durationMs
 * @param {{ slowMs: number }} opts
 */
function record(req, res, durationMs, opts) {
  state.total += 1;
  const key = `${req.method} ${simplifiedPath(req.originalUrl || req.url)}`;
  state.byKey[key] = (state.byKey[key] || 0) + 1;
  if (durationMs >= opts.slowMs) {
    state.slowTotal += 1;
  }
}

function snapshot() {
  const entries = Object.entries(state.byKey).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 60);
  return {
    started_at: new Date(startedAt).toISOString(),
    uptime_seconds: Math.round(((Date.now() - startedAt) / 1000) * 10) / 10,
    requests_total: state.total,
    slow_requests_total: state.slowTotal,
    by_route: Object.fromEntries(top),
  };
}

module.exports = {
  record,
  snapshot,
};
