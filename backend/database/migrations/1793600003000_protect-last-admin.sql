-- Up Migration
CREATE FUNCTION tb_users_protect_last_admin() RETURNS TRIGGER AS $$
DECLARE
    active_admins INTEGER;
    removing_admin BOOLEAN;
BEGIN
    removing_admin := OLD.role = 'HRD/Admin' AND OLD.is_active;
    IF TG_OP = 'UPDATE' THEN
        removing_admin := removing_admin AND (NEW.role <> 'HRD/Admin' OR NOT NEW.is_active);
    END IF;
    IF removing_admin THEN
        PERFORM pg_advisory_xact_lock(73188001);
        SELECT COUNT(*) INTO active_admins FROM "TB_USERS" WHERE role = 'HRD/Admin' AND is_active = TRUE;
        IF active_admins <= 1 THEN
            RAISE EXCEPTION 'Admin aktif terakhir harus dipertahankan' USING ERRCODE = '23514', CONSTRAINT = 'tb_users_last_admin';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tb_users_protect_last_admin BEFORE UPDATE OR DELETE ON "TB_USERS"
FOR EACH ROW EXECUTE FUNCTION tb_users_protect_last_admin();

-- Down Migration
DROP TRIGGER tb_users_protect_last_admin ON "TB_USERS";
DROP FUNCTION tb_users_protect_last_admin();
