-- Up Migration
CREATE TABLE "TB_DEPARTMENT" (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tb_department_code_check
        CHECK (code = UPPER(TRIM(code)) AND code <> ''),
    CONSTRAINT tb_department_name_check
        CHECK (TRIM(name) <> '')
);

CREATE FUNCTION tb_department_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tb_department_updated_at
BEFORE UPDATE ON "TB_DEPARTMENT"
FOR EACH ROW EXECUTE FUNCTION tb_department_set_updated_at();

-- Down Migration
DROP TABLE "TB_DEPARTMENT";
DROP FUNCTION tb_department_set_updated_at();