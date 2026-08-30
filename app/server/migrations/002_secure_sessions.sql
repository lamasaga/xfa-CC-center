CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    created_ip_hash TEXT,
    user_agent_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);
