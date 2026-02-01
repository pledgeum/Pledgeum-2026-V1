import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('--- DEBUG CLASS POPULATION ---');
        const uai = '9999999Z';

        // 1. Fetch Classes
        console.log(`[STEP 1] Fetching Classes for UAI ${uai}...`);
        const classesRes = await client.query('SELECT id, name FROM classes WHERE establishment_uai = $1', [uai]);
        const classes = classesRes.rows;
        const classIds = new Set(classes.map(c => c.id));
        console.log(`Found ${classes.length} classes.`);
        classes.forEach(c => console.log(` - [${c.id}] ${c.name}`));

        // 2. Fetch Students
        console.log(`[STEP 2] Fetching Students for UAI ${uai}...`);
        const studentsRes = await client.query("SELECT uid, first_name, last_name, class_id FROM users WHERE establishment_uai = $1 AND role = 'student'", [uai]);
        const students = studentsRes.rows;
        console.log(`Found ${students.length} students.`);

        // 3. Analysis
        let nullClass = 0;
        let orphanClass = 0;
        let validClass = 0;
        let sampleStudent = null;

        students.forEach(s => {
            if (!s.class_id) {
                nullClass++;
            } else if (!classIds.has(s.class_id)) {
                orphanClass++;
            } else {
                validClass++;
                if (!sampleStudent) sampleStudent = s; // Grab first valid one
            }
        });

        console.log(`[ANALYSIS]`);
        console.log(` - Students with NULL class_id: ${nullClass}`);
        console.log(` - Students with ORPHAN class_id (ID not in current classes): ${orphanClass}`);
        console.log(` - Students CORRECTLY linked: ${validClass}`);

        if (sampleStudent) {
            const c = classes.find(cls => cls.id === (sampleStudent as any).class_id);
            console.log(`[SAMPLE] Student ${(sampleStudent as any).first_name} is in class "${c?.name}" (${c?.id})`);
        } else if (students.length > 0) {
            console.log(`[SAMPLE] Student ${(students[0] as any).first_name} has class_id: ${(students[0] as any).class_id} (Valid? ${classIds.has((students[0] as any).class_id)})`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
