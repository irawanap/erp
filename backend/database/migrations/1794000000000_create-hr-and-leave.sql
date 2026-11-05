-- Up Migration
CREATE TABLE "TB_EMPLOYEES" (
 id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 nik VARCHAR(30) NOT NULL UNIQUE, full_name VARCHAR(150) NOT NULL,
 department_id BIGINT NOT NULL REFERENCES "TB_DEPARTMENT"(id), position VARCHAR(100),
 supervisor_id BIGINT REFERENCES "TB_EMPLOYEES"(id), join_date DATE NOT NULL,
 employment_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (employment_status IN ('Active','Inactive','Resigned')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (supervisor_id IS NULL OR supervisor_id <> id)
);
CREATE INDEX tb_employees_supervisor ON "TB_EMPLOYEES"(supervisor_id);
CREATE INDEX tb_employees_department ON "TB_EMPLOYEES"(department_id);
ALTER TABLE "TB_USERS" ADD CONSTRAINT tb_users_employee_fk FOREIGN KEY (employee_id) REFERENCES "TB_EMPLOYEES"(id);
CREATE TABLE "TB_LEAVE_TYPES" (
 id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL,
 requires_balance BOOLEAN NOT NULL DEFAULT TRUE, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "TB_HOLIDAYS" (
 id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 holiday_date DATE NOT NULL UNIQUE, name VARCHAR(150) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "TB_LEAVE_BALANCES" (
 id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 employee_id BIGINT NOT NULL REFERENCES "TB_EMPLOYEES"(id), leave_type_id BIGINT NOT NULL REFERENCES "TB_LEAVE_TYPES"(id),
 entitlement NUMERIC(6,2) NOT NULL CHECK(entitlement >= 0), used_days NUMERIC(6,2) NOT NULL DEFAULT 0,
 period_year SMALLINT NOT NULL CHECK(period_year BETWEEN 1900 AND 2200),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(employee_id,leave_type_id,period_year), CHECK(used_days >= 0 AND used_days <= entitlement)
);
CREATE TABLE "TB_LEAVE_REQUESTS" (
 id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 request_no VARCHAR(40) NOT NULL UNIQUE, employee_id BIGINT NOT NULL REFERENCES "TB_EMPLOYEES"(id),
 leave_type_id BIGINT NOT NULL REFERENCES "TB_LEAVE_TYPES"(id), start_date DATE NOT NULL, end_date DATE NOT NULL,
 total_days NUMERIC(6,2) NOT NULL CHECK(total_days > 0), reason TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Approved','Rejected','Cancelled')),
 approver_id BIGINT REFERENCES "TB_EMPLOYEES"(id), submitted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(start_date <= end_date), CHECK(EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM end_date))
);
CREATE INDEX tb_leave_requests_employee ON "TB_LEAVE_REQUESTS"(employee_id,status,start_date,end_date);
CREATE INDEX tb_leave_requests_approver ON "TB_LEAVE_REQUESTS"(approver_id,status);
CREATE TABLE "TB_LEAVE_REQUEST_DAYS" (
 request_id BIGINT NOT NULL REFERENCES "TB_LEAVE_REQUESTS"(id), leave_date DATE NOT NULL,
 PRIMARY KEY(request_id,leave_date)
);
CREATE TABLE "TB_LEAVE_APPROVALS" (
 id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 leave_request_id BIGINT NOT NULL REFERENCES "TB_LEAVE_REQUESTS"(id), approver_id BIGINT NOT NULL REFERENCES "TB_EMPLOYEES"(id),
 decision VARCHAR(20) NOT NULL CHECK(decision IN ('Approved','Rejected')), comment TEXT NOT NULL DEFAULT '',
 decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(leave_request_id)
);
CREATE FUNCTION tb_hr_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tb_employees_updated_at BEFORE UPDATE ON "TB_EMPLOYEES" FOR EACH ROW EXECUTE FUNCTION tb_hr_updated_at();
CREATE TRIGGER tb_types_updated_at BEFORE UPDATE ON "TB_LEAVE_TYPES" FOR EACH ROW EXECUTE FUNCTION tb_hr_updated_at();
CREATE TRIGGER tb_holidays_updated_at BEFORE UPDATE ON "TB_HOLIDAYS" FOR EACH ROW EXECUTE FUNCTION tb_hr_updated_at();
CREATE TRIGGER tb_balances_updated_at BEFORE UPDATE ON "TB_LEAVE_BALANCES" FOR EACH ROW EXECUTE FUNCTION tb_hr_updated_at();
CREATE TRIGGER tb_requests_updated_at BEFORE UPDATE ON "TB_LEAVE_REQUESTS" FOR EACH ROW EXECUTE FUNCTION tb_hr_updated_at();
CREATE FUNCTION tb_employee_revoke_sessions() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
  UPDATE "TB_USERS" SET auth_version = auth_version + 1 WHERE employee_id = NEW.id;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tb_employee_revoke_sessions AFTER UPDATE ON "TB_EMPLOYEES" FOR EACH ROW EXECUTE FUNCTION tb_employee_revoke_sessions();
CREATE OR REPLACE FUNCTION tb_users_revoke_sessions() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.email IS DISTINCT FROM OLD.email
 OR NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active
 OR NEW.auth_version IS DISTINCT FROM OLD.auth_version OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
  NEW.auth_version = OLD.auth_version + 1;
  DELETE FROM "TB_SESSIONS" WHERE user_id = OLD.id;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration
DROP TRIGGER tb_employee_revoke_sessions ON "TB_EMPLOYEES";
DROP FUNCTION tb_employee_revoke_sessions();
ALTER TABLE "TB_USERS" DROP CONSTRAINT tb_users_employee_fk;
UPDATE "TB_USERS" SET employee_id = NULL WHERE employee_id IS NOT NULL;
CREATE OR REPLACE FUNCTION tb_users_revoke_sessions() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.email IS DISTINCT FROM OLD.email
 OR NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active
 OR NEW.auth_version IS DISTINCT FROM OLD.auth_version THEN
  NEW.auth_version = OLD.auth_version + 1; DELETE FROM "TB_SESSIONS" WHERE user_id = OLD.id;
 END IF; RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TABLE "TB_LEAVE_APPROVALS", "TB_LEAVE_REQUEST_DAYS", "TB_LEAVE_REQUESTS", "TB_LEAVE_BALANCES", "TB_HOLIDAYS", "TB_LEAVE_TYPES", "TB_EMPLOYEES";
DROP FUNCTION tb_hr_updated_at();
