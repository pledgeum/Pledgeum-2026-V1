import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pool from './src/lib/pg';

async function list() {
    try {
        const query = "SELECT DISTINCT metadata->>'ent_nom' as ent_nom FROM conventions WHERE metadata->>'ent_nom' IS NOT NULL AND metadata->>'ent_nom' != '' ORDER BY metadata->>'ent_nom'";
        const res = await pool.query(query);
        console.log("Entreprises dans les conventions (\n)");
        res.rows.forEach(r => console.log("- " + r.ent_nom));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}
list();
