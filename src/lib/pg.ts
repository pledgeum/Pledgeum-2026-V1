import { Pool, PoolConfig } from 'pg';

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

// Global singleton pattern to prevent multiple pools in development (HMR) 
// and potentially reuse across serverless function warm starts on Vercel.
const globalForPg = global as unknown as { postgresPool: Pool };

export const pool = globalForPg.postgresPool || new Pool(connectionConfig);

if (process.env.NODE_ENV !== 'production') {
    globalForPg.postgresPool = pool;
}

export default pool;
