const departments = [
    { 
        code: 'OPS',
        name: 'Operation'
    },
    {
        code: 'HRD',
        name: 'Human Resources'
    },
];

async function seedDepartments(client) {
    for (const department of departments) {
        await client.query (
            `INSERT INTO "TB_DEPARTMENT" (code, name)
            VALUES ($1, $2)
            ON CONFLICT (code) DO NOTHING`,
            [department.code, department.name],
        );
    }
}

module.exports = seedDepartments;