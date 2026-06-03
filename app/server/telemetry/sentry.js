/**
 * 可选接入 Sentry：仅当设置 SENTRY_DSN 且已安装 @sentry/node 时启用。
 * 安装：在 app 目录执行 npm i @sentry/node
 */

let inited = false;

function tryInit() {
  if (inited) return;
  const dsn = process.env.SENTRY_DSN ? String(process.env.SENTRY_DSN).trim() : '';
  if (!dsn) return;

  let Sentry;
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    Sentry = require('@sentry/node');
  } catch {
    console.warn(
      '[telemetry] SENTRY_DSN 已设置但未安装 @sentry/node，跳过初始化。请执行: npm i @sentry/node'
    );
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number.parseFloat(String(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05')) || 0.05,
  });
  inited = true;
}

function captureException(err, ctx) {
  if (!inited) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.withScope((scope) => {
      if (ctx && ctx.requestId) scope.setTag('request_id', ctx.requestId);
      if (ctx && ctx.path) scope.setExtra('path', ctx.path);
      Sentry.captureException(err);
    });
  } catch {
    // ignore
  }
}

module.exports = { tryInit, captureException };
