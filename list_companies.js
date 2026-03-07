const pool = require('./src/lib/pg').default || require('./src/lib/pg');

async function list() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conventions'");
        console.log("Columns:", res.rows);

        const conventions = await pool.query("SELECT * FROM conventions LIMIT 5");
        console.log("Sample:", conventions.rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}
list();
