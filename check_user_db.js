const pool = require('./src/lib/pg').default || require('./src/lib/pg');

async function checkUser() {
    const uid = 'collab-fca95709-169e-4364-a2f4-c2aad01826fe';
    console.log(`Checking for user UID: ${uid}`);
    try {
        const res = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
        console.log(`RowCount: ${res.rowCount}`);
        if (res.rowCount > 0) {
            console.log('User found:', res.rows[0]);
        } else {
            console.log('User NOT found in users table.');
        }
    } catch (err) {
        console.error('Query error:', err);
    } finally {
        await pool.end();
    }
}

checkUser();
