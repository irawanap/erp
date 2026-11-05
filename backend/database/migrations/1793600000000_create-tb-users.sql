-- Up Migration
CREATE TABLE "TB_USERS" (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Employee',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tb_users_role_check CHECK (role IN ('Employee', 'Supervisor', 'HRD/Admin')),
    CONSTRAINT tb_users_email_check CHECK (email = LOWER(TRIM(email)) AND email <> '')
);

CREATE FUNCTION tb_users_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tb_users_updated_at
BEFORE UPDATE ON "TB_USERS"
FOR EACH ROW EXECUTE FUNCTION tb_users_set_updated_at();

-- Down Migration
DROP TABLE "TB_USERS";
DROP FUNCTION tb_users_set_updated_at();
