/**
 * One-time migration: creates mira_app.app_clients table in BigQuery
 * and seeds it from the CLIENTS_JSON environment variable.
 *
 * Run once (from the project root):
 *   node scripts/migrate-clients.mjs
 *
 * Requires .env.local to be present with GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_JSON,
 * and CLIENTS_JSON.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// Manual .env.local parsing (avoid dotenv dependency)
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.warn('.env.local not found or unreadable:', e.message);
  }
}

loadEnv();

import { BigQuery } from '@google-cloud/bigquery';

const PROJECT = process.env.GCP_PROJECT_ID;
const DATASET = 'mira_app';
const TABLE   = 'app_clients';
const FULL    = `\`${PROJECT}.${DATASET}.${TABLE}\``;

const bigquery = new BigQuery({
  projectId: PROJECT,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

async function main() {
  if (!PROJECT) throw new Error('GCP_PROJECT_ID is not set');

  // ── 1. Ensure dataset exists ─────────────────────────────────────────────
  const dataset = bigquery.dataset(DATASET);
  const [dsExists] = await dataset.exists();
  if (!dsExists) {
    console.log(`Creating dataset ${DATASET}…`);
    await bigquery.createDataset(DATASET, { location: 'US' });
    console.log('  Dataset created.');
  } else {
    console.log(`Dataset ${DATASET} already exists.`);
  }

  // ── 2. Create table ───────────────────────────────────────────────────────
  console.log(`Creating table ${FULL} (if not exists)…`);
  await bigquery.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${FULL} (
        id            STRING    NOT NULL,
        display_name  STRING    NOT NULL,
        email         STRING    NOT NULL,
        password      STRING    NOT NULL,
        client_name   STRING,
        role          STRING    NOT NULL,
        is_active     BOOL      DEFAULT TRUE,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
    `,
    location: 'US',
  });
  console.log('  Table ready.');

  // ── 3. Seed from CLIENTS_JSON ─────────────────────────────────────────────
  let clients;
  try {
    clients = JSON.parse(process.env.CLIENTS_JSON || '[]');
  } catch (e) {
    console.error('CLIENTS_JSON parse error:', e.message);
    process.exit(1);
  }

  if (clients.length === 0) {
    console.log('No entries in CLIENTS_JSON — nothing to seed.');
    return;
  }

  console.log(`\nSeeding ${clients.length} client(s)…`);
  for (const client of clients) {
    const id          = client.id || randomUUID();
    const displayName = client.display_name || client.name || client.email;
    const clientName  = client.client_name  || null;
    const role        = client.role         || 'client';

    // MERGE so re-running the script is safe (no duplicate inserts)
    await bigquery.query({
      query: `
        MERGE ${FULL} AS T
        USING (SELECT @email AS email) AS S
        ON LOWER(T.email) = LOWER(S.email)
        WHEN NOT MATCHED THEN
          INSERT (id, display_name, email, password, client_name, role, is_active, created_at, updated_at)
          VALUES (
            @id,
            @display_name,
            @email,
            @password,
            NULLIF(@client_name, ''),
            @role,
            TRUE,
            CURRENT_TIMESTAMP(),
            CURRENT_TIMESTAMP()
          )
      `,
      params: {
        id,
        display_name: displayName,
        email:        client.email,
        password:     client.password,
        client_name:  clientName ?? '',
        role,
      },
      location: 'US',
    });
    console.log(`  ✓ ${client.email} (${role})`);
  }

  console.log('\nMigration complete. You can now remove CLIENTS_JSON from your env after verifying login works.');
}

main().catch(e => { console.error('\nMigration failed:', e.message); process.exit(1); });
