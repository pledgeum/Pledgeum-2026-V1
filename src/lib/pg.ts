import { Pool, PoolConfig } from 'pg';

let pool: Pool;

// Define connection configuration
let connectionConfig: PoolConfig;

if (process.env.DATABASE_URL) {
    connectionConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Force SSL settings compatible with Scaleway
    };
} else if (process.env.POSTGRES_HOST) {
    connectionConfig = {
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        ssl: { rejectUnauthorized: false } // Needed for Scaleway Managed DB
    };
} else {
    throw new Error('Please define DATABASE_URL or POSTGRES_HOST environment variable');
}

if (process.env.NODE_ENV === 'production') {
    pool = new Pool(connectionConfig);
} else {
    // Determine if we are in a serverless context or persistent dev server
    if (!(global as any).postgresPool) {
        (global as any).postgresPool = new Pool(connectionConfig);
    }
    pool = (global as any).postgresPool;
}

export default pool;
