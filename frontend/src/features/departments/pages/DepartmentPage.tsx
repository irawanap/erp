import { useState } from "react";
import type { FormEvent } from "react";
import { useDepartments } from "../department.queries";
import { messageOf, statusOf } from "@/lib/api";
import { Notice } from '@/components/common/Notice'
import { SecurityDialog } from '@/components/common/SecurityDialog'
import { reauthenticate } from '@/features/auth/auth.api'
import type { CredentialsProof } from '@/features/auth/auth.types'
import { useAuth } from '@/features/auth/use-auth'
import { DepartmentTable } from '../components/DepartmentTable'
import { DepartmentForm } from '../components/DepartmentForm'
import {
  useCreateDepartment,
  useUpdateDepartment,
} from '../department.queries'
import type { Department } from '../department.types'
import type { DepartmentForm as DepartmentFormValues } from '../department.validation'

export function DepartmentPage() {
    const [keyword, setKeyword] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const departments = useDepartments({
        page,
        limit: 10,
        search,
    })

    function handleSearch(event: FormEvent<HTMLFormElement>){
        event.preventDefault()
        setSearch(keyword.trim())
        setPage(1)
    }

    const auth = useAuth()
    const { user } = auth
    const canEdit = user?.role === 'HRD/Admin'

    const [formOpen, setFormOpen] = useState(false)
    const [selectedDepartment, setSelectedDepartment] =
    useState<Department | null>(null)
    const [formError, setFormError] = useState('')
    const [success, setSuccess] = useState('')
    const [pendingSave, setPendingSave] = useState<{ id?: string; values: DepartmentFormValues } | null>(null)

    const create = useCreateDepartment()
    const update = useUpdateDepartment()

    function handleCreate() {
        setSelectedDepartment(null)
        setSuccess('')
        setFormError('')
        setFormOpen(true)
    }

    function handleEdit(department: Department) {
        setSuccess('')
        setSelectedDepartment(department)
        setFormError('')
        setFormOpen(true)
    }

    function handleClose() {
        setFormOpen(false)
        setSelectedDepartment(null)
        setFormError('')
    }

    async function saveDepartment(action: { id?: string; values: DepartmentFormValues }) {
        if (!canEdit) return
        if (action.id) {
            await update.mutateAsync({ id: action.id, input: action.values })
        } else {
            await create.mutateAsync(action.values)
        }
        handleClose()
        setSuccess(action.id ? 'Departemen berhasil diperbarui.' : 'Departemen berhasil ditambahkan.')
    }

    async function handleSave(values: DepartmentFormValues) {
        setFormError('')
        setSuccess('')
        const action = { id: selectedDepartment?.id, values }
        try {
            await saveDepartment(action)
        } catch (error) {
            if (statusOf(error) === 401 && messageOf(error) === 'Autentikasi ulang diperlukan') {
                setPendingSave(action)
                return
            }
            setFormError(messageOf(error))
            if (statusOf(error) === 401) await auth.refresh()
        }
    }

    async function confirmSave(proof: CredentialsProof) {
        if (!pendingSave) return
        await reauthenticate(proof)
        const action = pendingSave
        setPendingSave(null)
        try {
            await saveDepartment(action)
        } catch (error) {
            setFormError(messageOf(error))
            if (statusOf(error) === 401) await auth.refresh()
        }
    }

    return (
        <section className="panel departments-page">
            <div className="panel-header">
                <h2>Departemen</h2>

                {canEdit && (
                    <button
                        type="button"
                        className="button button-primary"
                        disabled={formOpen}
                        onClick={handleCreate}
                    >
                        Tambah departemen
                    </button>
                )}
            </div>

            {success && <Notice kind="success">{success}</Notice>}
            {pendingSave && <SecurityDialog
                title="Verifikasi sebelum menyimpan"
                description="Masukkan password saat ini dan kode MFA jika aktif. Setelah verifikasi berhasil, perubahan departemen akan disimpan."
                passwordChange={false}
                onConfirm={confirmSave}
                onClose={() => setPendingSave(null)}
            />}

            {canEdit && formOpen && (
                <section className="department-editor" aria-label="Form departemen">
                    <div className="panel-header">
                        <h3>
                            {selectedDepartment
                            ? 'Edit departemen'
                            : 'Tambah departemen'}
                        </h3>
                    </div>

                    <DepartmentForm
                        key={selectedDepartment?.id ?? 'create'}
                        initialValues={
                            selectedDepartment
                            ? {
                                code: selectedDepartment.code,
                                name: selectedDepartment.name,
                                }
                            : undefined
                        }
                        pending={create.isPending || update.isPending || !!pendingSave}
                        error={formError}
                        onSubmit={handleSave}
                        onCancel={handleClose}
                    />
                </section>
            )}

            <form className="department-search" onSubmit={handleSearch}>
                <label htmlFor="department-search" className="sr-only">
                    Cari kode atau nama departemen
                </label>

                <input
                    id="department-search"
                    className="text-input"
                    type="search"
                    placeholder="Cari kode atau nama departemen"
                    maxLength={100}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                />

                <button className="button button-primary" type="submit">
                    Cari
                </button>
            </form>

            {departments.isPending ? (
                <div className="table-state" role="status">
                    Memuat departemen…
                </div>
            ) : departments.isError ? (
                <div className="table-state">
                    <p role="alert">{messageOf(departments.error)}</p>

                    {statusOf(departments.error) === 401 && <button className="button button-outline" onClick={() => auth.refresh()}>Periksa session</button>}
                    <button
                        className="button button-outline"
                        onClick={() => departments.refetch()}
                    >
                        Coba kembali
                    </button>
                </div>
            ) : (
                <>
                {departments.data.data.length === 0 ? (
                    <div className="table-state">
                        <p>
                            {search
                            ? 'Departemen tidak ditemukan.'
                            : 'Belum ada departemen pada halaman ini.'}
                        </p>
                    </div>
                ) : (
                    <DepartmentTable
                        departments={departments.data.data}
                        onEdit={canEdit && !formOpen ? handleEdit : undefined}
                    />
                )}

                <div className="table-footer">
                    <span>
                        {departments.data.pagination.total} departemen ditemukan
                    </span>

                    <div className="pagination">
                        <button
                            className="button button-outline"
                            disabled={page <= 1 || departments.isFetching}
                            onClick={() => setPage((current) => current - 1)}
                        >
                            Sebelumnya
                        </button>

                        <span aria-live="polite">
                            {page} / {Math.max(
                                1,
                                departments.data.pagination.totalPages,
                            )}
                        </span>

                        <button
                            className="button button-outline"
                            disabled={
                                page >= departments.data.pagination.totalPages ||
                                departments.isFetching
                            }
                            onClick={() => setPage((current) => current + 1)}
                        >
                            Berikutnya
                        </button>
                    </div>
                </div>
                </>
            )}
        </section>
    )
}
