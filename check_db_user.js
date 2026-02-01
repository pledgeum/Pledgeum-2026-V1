
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb',
});

async function run() {
    try {
        await client.connect();
        // Changed id to uid
        const res = await client.query("SELECT uid, email, first_name, last_name, birth_date, class_id FROM users WHERE email = 'fabrice.dumasdelage@yahoo.fr'");
        console.log('User:', res.rows[0]);

        if (res.rows[0] && res.rows[0].class_id) {
            const classRes = await client.query("SELECT * FROM classes WHERE id = $1", [res.rows[0].class_id]);
            console.log('Class:', classRes.rows[0]);
        } else {
            console.log('No class_id or user found.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
