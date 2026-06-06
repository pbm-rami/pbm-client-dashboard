export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/client';
import { randomUUID } from 'crypto';

const bigquery = new BigQuery({
  projectId:   process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

const TABLE = '`pbm-pl-data-bank.mira_app.app_clients`';

/**
 * GET /api/admin/clients
 * Returns all clients (active and inactive) ordered by display_name.
 * Admin only.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT
          id, display_name, email, client_name, role, is_active,
          created_at, updated_at
        FROM ${TABLE}
        ORDER BY display_name ASC
      `,
      location: 'US',
    });

    const data = rows.map(r => ({
      ...r,
      created_at: r.created_at?.value ?? r.created_at,
      updated_at: r.updated_at?.value ?? r.updated_at,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error('Admin clients GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/clients
 * Creates a new client. Body: { display_name, email, password, client_name, role }
 * Admin only.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { display_name, email, password, client_name, role } = body;

    if (!display_name?.trim()) return Response.json({ error: 'display_name is required' }, { status: 400 });
    if (!email?.trim())        return Response.json({ error: 'email is required' },        { status: 400 });
    if (!role?.trim())         return Response.json({ error: 'role is required' },         { status: 400 });
    // password is optional — clients can use Google or magic link instead

    const id = randomUUID();

    // Build INSERT dynamically so we can omit password when not provided
    const hasPassword = password?.trim();
    const cols   = 'id, display_name, email, client_name, role, is_active, created_at, updated_at';
    const vals   = '@id, @display_name, @email, NULLIF(@client_name, \'\'), @role, TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()';
    const params = {
      id,
      display_name: display_name.trim(),
      email:        email.trim().toLowerCase(),
      client_name:  client_name?.trim() ?? '',
      role:         role.trim(),
    };

    const query = hasPassword
      ? `INSERT INTO ${TABLE} (password, ${cols}) VALUES (@password, ${vals})`
      : `INSERT INTO ${TABLE} (${cols}) VALUES (${vals})`;

    if (hasPassword) params.password = password.trim();

    await bigquery.query({ query, params, location: 'US' });

    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error('Admin clients POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
