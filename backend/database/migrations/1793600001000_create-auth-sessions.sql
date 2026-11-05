-- Up Migration
ALTER TABLE "TB_USERS" ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "TB_SESSIONS" (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT REFERENCES "TB_USERS"(id) ON DELETE CASCADE,
    user_version INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK ((user_id IS NULL) = (user_version IS NULL))
);
CREATE INDEX tb_sessions_user_id_idx ON "TB_SESSIONS" (user_id);
CREATE INDEX tb_sessions_expires_at_idx ON "TB_SESSIONS" (expires_at);

CREATE TABLE "TB_AUTH_THROTTLES" (
    key_hash CHAR(64) PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX tb_auth_throttles_expires_at_idx ON "TB_AUTH_THROTTLES" (expires_at);

CREATE FUNCTION tb_users_revoke_sessions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        NEW.auth_version = OLD.auth_version + 1;
        DELETE FROM "TB_SESSIONS" WHERE user_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tb_users_revoke_sessions
BEFORE UPDATE ON "TB_USERS"
FOR EACH ROW EXECUTE FUNCTION tb_users_revoke_sessions();

-- Down Migration
DROP TRIGGER tb_users_revoke_sessions ON "TB_USERS";
DROP FUNCTION tb_users_revoke_sessions();
DROP TABLE "TB_AUTH_THROTTLES";
DROP TABLE "TB_SESSIONS";
ALTER TABLE "TB_USERS" DROP COLUMN auth_version;
