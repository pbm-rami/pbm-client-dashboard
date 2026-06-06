export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/client';

const bigquery = new BigQuery({
  projectId:   process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

const TABLE = '`pbm-pl-data-bank.mira_app.app_clients`';

/**
 * PUT /api/admin/clients/[id]
 * Updates a client. Only fields present in the body are updated.
 * Password is only updated when the field is non-empty.
 * Admin only.
 */
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = params;

  try {
    const body = await request.json();
    const { display_name, email, password, client_name, role, is_active } = body;

    const setClauses  = ['updated_at = CURRENT_TIMESTAMP()'];
    const queryParams = { id };

    if (display_name !== undefined) {
      setClauses.push('display_name = @display_name');
      queryParams.display_name = display_name.trim();
    }
    if (email !== undefined) {
      setClauses.push('email = @email');
      queryParams.email = email.trim().toLowerCase();
    }
    // Only update password when the caller explicitly sent a non-empty value
    if (password && password.trim()) {
      setClauses.push('password = @password');
      queryParams.password = password.trim();
    }
    if (client_name !== undefined) {
      // NULLIF converts empty string → NULL (admin has no client_name)
      setClauses.push('client_name = NULLIF(@client_name, \'\')');
      queryParams.client_name = client_name?.trim() ?? '';
    }
    if (role !== undefined) {
      setClauses.push('role = @role');
      queryParams.role = role.trim();
    }
    if (is_active !== undefined) {
      setClauses.push('is_active = @is_active');
      queryParams.is_active = Boolean(is_active);
    }

    await bigquery.query({
      query:    `UPDATE ${TABLE} SET ${setClauses.join(', ')} WHERE id = @id`,
      params:   queryParams,
      location: 'US',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Admin clients PUT error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/clients/[id]
 * Soft-deletes a client by setting is_active = FALSE.
 * Admin only.
 */
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = params;

  try {
    await bigquery.query({
      query:    `UPDATE ${TABLE} SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP() WHERE id = @id`,
      params:   { id },
      location: 'US',
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Admin clients DELETE error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
