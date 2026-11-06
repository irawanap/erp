import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { departmentSchema } from "../department.validation";
import type { DepartmentForm as DepartmentFormValues } from '../department.validation';

interface DepartmentFormProps {
    initialValues?: DepartmentFormValues
    pending: boolean
    error?: string
    onSubmit: (values: DepartmentFormValues) => Promise<void>
    onCancel: () => void
}

export function DepartmentForm({
    initialValues,
    pending,
    error,
    onSubmit,
    onCancel,
}: DepartmentFormProps) {
    const form = useForm<DepartmentFormValues>({
        resolver: zodResolver(departmentSchema),
        defaultValues: initialValues ?? {
            code: '',
            name: '',
        },
    })

    const saving = pending || form.formState.isSubmitting

    return (
        <form
            className="department-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
        >
        {error && <p role="alert">{error}</p>}

        <div className="form-field">
            <label htmlFor="department-code">Kode departemen</label>

            <input
                id="department-code"
                className="text-input"
                placeholder="Contoh: FIN"
                maxLength={20}
                disabled={saving}
                aria-invalid={!!form.formState.errors.code}
                aria-describedby={
                    form.formState.errors.code ? 'department-code-error' : undefined
                }
                {...form.register('code')}
            />

            {form.formState.errors.code && (
                <p id="department-code-error" className="field-error">
                    {form.formState.errors.code.message}
                </p>
            )}
        </div>

        <div className="form-field">
            <label htmlFor="department-name">Nama departemen</label>

            <input
                id="department-name"
                className="text-input"
                placeholder="Contoh: Finance"
                maxLength={100}
                disabled={saving}
                aria-invalid={!!form.formState.errors.name}
                aria-describedby={
                    form.formState.errors.name ? 'department-name-error' : undefined
                }
                {...form.register('name')}
            />

            {form.formState.errors.name && (
                <p id="department-name-error" className="field-error">
                    {form.formState.errors.name.message}
                </p>
            )}
        </div>

        <div className="department-form-actions">
            <button
                type="button"
                className="button button-outline"
                disabled={saving}
                onClick={onCancel}
            >
            Batal
            </button>

            <button
                type="submit"
                className="button button-primary"
                disabled={saving}
            >
            {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
        </div>
        </form>
    )
}