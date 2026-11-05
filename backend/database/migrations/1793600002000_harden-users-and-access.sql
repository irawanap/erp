-- Up Migration
ALTER TABLE "TB_USERS" ADD COLUMN public_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "TB_USERS" ADD CONSTRAINT tb_users_public_id_unique UNIQUE (public_id);
ALTER TABLE "TB_SESSIONS" ADD COLUMN public_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "TB_SESSIONS" ADD CONSTRAINT tb_sessions_public_id_unique UNIQUE (public_id);
ALTER TABLE "TB_SESSIONS" ADD COLUMN verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TB_SESSIONS" ADD COLUMN mfa_verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "TB_SESSIONS" SET verified_at = created_at;

CREATE TABLE "TB_USER_MFA" (
    user_id BIGINT PRIMARY KEY REFERENCES "TB_USERS"(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    pending_session_hash CHAR(64),
    expires_at TIMESTAMPTZ,
    last_counter BIGINT NOT NULL DEFAULT -1,
    recovery_hashes TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE "TB_AUDIT_LOGS" (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    actor_public_id UUID,
    subject_public_id UUID,
    action VARCHAR(80) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX tb_audit_logs_created_at_idx ON "TB_AUDIT_LOGS" (created_at DESC, id DESC);
CREATE INDEX tb_audit_logs_subject_idx ON "TB_AUDIT_LOGS" (subject_public_id);

CREATE FUNCTION tb_audit_logs_immutable() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are append only' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tb_audit_logs_immutable BEFORE UPDATE OR DELETE ON "TB_AUDIT_LOGS"
FOR EACH ROW EXECUTE FUNCTION tb_audit_logs_immutable();

CREATE FUNCTION tb_users_audit() RETURNS TRIGGER AS $$
DECLARE
    actor UUID := NULLIF(current_setting('app.actor_public_id', TRUE), '')::UUID;
    changes JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "TB_AUDIT_LOGS" (actor_public_id, subject_public_id, action, details)
        VALUES (actor, NEW.public_id, 'user.created', jsonb_build_object('role', NEW.role));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO "TB_AUDIT_LOGS" (actor_public_id, subject_public_id, action)
        VALUES (actor, OLD.public_id, 'user.deleted');
    ELSE
        changes := jsonb_build_object(
            'emailChanged', NEW.email IS DISTINCT FROM OLD.email,
            'passwordChanged', NEW.password_hash IS DISTINCT FROM OLD.password_hash,
            'roleChanged', NEW.role IS DISTINCT FROM OLD.role,
            'statusChanged', NEW.is_active IS DISTINCT FROM OLD.is_active);
        IF changes @> '{"emailChanged":true}' OR changes @> '{"passwordChanged":true}'
           OR changes @> '{"roleChanged":true}' OR changes @> '{"statusChanged":true}' THEN
            INSERT INTO "TB_AUDIT_LOGS" (actor_public_id, subject_public_id, action, details)
            VALUES (actor, NEW.public_id, 'user.updated', changes);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tb_users_audit AFTER INSERT OR UPDATE OR DELETE ON "TB_USERS"
FOR EACH ROW EXECUTE FUNCTION tb_users_audit();

CREATE OR REPLACE FUNCTION tb_users_revoke_sessions() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.auth_version IS DISTINCT FROM OLD.auth_version THEN
        NEW.auth_version = OLD.auth_version + 1;
        DELETE FROM "TB_SESSIONS" WHERE user_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration
DROP TRIGGER tb_users_audit ON "TB_USERS";
DROP FUNCTION tb_users_audit();
DROP TABLE "TB_AUDIT_LOGS";
DROP FUNCTION tb_audit_logs_immutable();
DROP TABLE "TB_USER_MFA";
ALTER TABLE "TB_SESSIONS" DROP COLUMN public_id, DROP COLUMN verified_at, DROP COLUMN mfa_verified;
ALTER TABLE "TB_USERS" DROP COLUMN public_id;
CREATE OR REPLACE FUNCTION tb_users_revoke_sessions() RETURNS TRIGGER AS $$
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
