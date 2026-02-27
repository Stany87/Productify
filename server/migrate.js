import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import { fileURLToPath } from 'url';
const { Client } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    const client = new Client({
        connectionString: 'postgresql://postgres:StanyGregor%40281205@db.xmzqxpvmbeofrfrhgrdm.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await client.connect();
        console.log('Connected to Supabase. Applying schema...');
        await client.query(schemaSql);
        console.log('Schema applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
