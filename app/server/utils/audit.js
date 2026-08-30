const { randomUUID } = require('crypto');
const { getDb } = require('../db');

function json(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ serialization_error: true });
  }
}

function writeAudit(req, { action, entityType, entityId = null, before = null, after = null, metadata = null, outcome = 'success' }) {
  getDb()
    .prepare(
      `INSERT INTO audit_events
       (id, actor_user_id, action, entity_type, entity_id, request_id, outcome, before_json, after_json, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      req.user?.id || null,
      action,
      entityType,
      entityId,
      req.id || null,
      outcome,
      json(before),
      json(after),
      json(metadata)
    );
}

module.exports = { writeAudit };
