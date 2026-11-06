import { useDepartments } from "../department.queries";
import { messageOf } from "@/lib/api";

export function DepartmentPage() {
    const departments = useDepartments({
        page: 1,
        limit: 10
    })

    if ( departments.isPending) {
        return <p>Memuat departemen...</p>
    }

    if (departments.isError) {
        return (
            <div>
                <p role="alert">{messageOf(departments.error)}</p>
                <button onClick={() => departments.refetch()}>Coba Kembali</button>
            </div>
        )
    }

    return (
        <section className="panel">
            <div className="panel-header">
                <h2>Departemen</h2>
            </div>

            {departments.data.data.length === 0 ? (
                <p>Belum ada departemen.</p>
            ) : (
                <div className="table-scroll">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Nama departemen</th>
                            </tr>
                        </thead>
                        <tbody>
                        {departments.data.data.map((department) => (
                            <tr key={department.id}>
                                <td>{department.code}</td>
                                <td>{department.name}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}