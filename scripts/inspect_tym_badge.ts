
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspect() {
    const pool = (await import('../src/lib/pg')).default;
    try {
        // 1. Find Student
        const studentQuery = `
            SELECT uid, first_name, last_name, email 
            FROM users 
            WHERE first_name ILIKE '%Tyméo%' AND last_name ILIKE '%BERTHOU%'
        `;
        const studentRes = await pool.query(studentQuery);

        if (studentRes.rows.length === 0) {
            console.log("No student found for 'Tyméo BERTHOU'");
            return;
        }

        const student = studentRes.rows[0];
        console.log("Found Student:", student);

        // 2. Find Convention
        const conventionQuery = `
            SELECT *
            FROM conventions 
            WHERE student_uid = $1
        `;
        const conventionRes = await pool.query(conventionQuery, [student.uid]);


        if (conventionRes.rows.length === 0) {
            console.log("No conventions found for this student.");
            return;
        }

        console.log(`Found ${conventionRes.rows.length} conventions.`);

        for (const conv of conventionRes.rows) {
            console.log("\n--- Convention Keys ---", Object.keys(conv));
            console.log("ID:", conv.id);
            // Check if company info is in any column
            // console.log("Full Conv:", JSON.stringify(conv, null, 2)); 

            console.log("Status:", conv.status);
            console.log("Full Metadata:", JSON.stringify(conv.metadata, null, 2));



            const sigs = conv.metadata?.signatures;
            console.log("Metadata.signatures:", JSON.stringify(sigs, null, 2));

            // Legacy check mentioned by user
            const legacySignedAt = sigs?.student?.signedAt;
            const currentStudentAt = sigs?.studentAt;

            console.log("Check 1 (signatures.studentAt):", currentStudentAt);
            console.log("Check 2 (signatures.student.signedAt):", legacySignedAt);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

inspect();
