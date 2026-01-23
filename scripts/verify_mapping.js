
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('check_api.json', 'utf8'));

if (data.success && Array.isArray(data.conventions)) {
    const mapped = data.conventions.map(c => ({
        ...c,
        ...(c.metadata || {}),
        stage_date_debut: c.date_start,
        stage_date_fin: c.date_end,
        studentId: c.student_uid,
        schoolId: c.establishment_uai,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
    }));

    console.log("Mapped Convention Sample:");
    console.log(JSON.stringify(mapped[0], null, 2));

    // verification
    const c = mapped[0];
    if (c.eleve_nom && c.ent_nom && c.stage_date_debut === c.date_start) {
        console.log("SUCCESS: MAPPING WORKS");
    } else {
        console.log("FAILURE: MAPPING DOES NOT WORK");
    }
}
