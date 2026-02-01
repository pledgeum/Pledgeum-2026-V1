const { Pool } = require('pg');
const XLSX = require('xlsx');

// Note: Ensure 'xlsx' is installed: npm install xlsx

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function exportToExcel() {
    const client = await pool.connect();
    console.log("📊 Starting Database Export...");

    try {
        const wb = XLSX.utils.book_new();

        const tables = ['users', 'classes', 'conventions', 'establishments'];

        for (const table of tables) {
            console.log(`   Fetching table: ${table}...`);
            const res = await client.query(`SELECT * FROM ${table}`);

            // Post-process rows to stringify JSON objects/arrays
            const processedRows = res.rows.map(row => {
                const newRow = { ...row };
                for (const key in newRow) {
                    if (newRow[key] && typeof newRow[key] === 'object' && !(newRow[key] instanceof Date)) {
                        try {
                            newRow[key] = JSON.stringify(newRow[key]);
                        } catch (e) {
                            // keep as is if fail
                        }
                    }
                }
                return newRow;
            });

            const ws = XLSX.utils.json_to_sheet(processedRows);
            XLSX.utils.book_append_sheet(wb, ws, table.charAt(0).toUpperCase() + table.slice(1));
        }

        const fileName = 'full_database_dump.xlsx';
        XLSX.writeFile(wb, fileName);
        console.log(`✅ Export complete: ${fileName} created in root directory.`);

    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error("❌ Error: 'xlsx' library not found. Please run: npm install xlsx");
        } else {
            console.error("❌ Export Error:", err);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

exportToExcel();
