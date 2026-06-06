export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'NOT SET',
    GCP_SERVICE_ACCOUNT_JSON_set: !!process.env.GCP_SERVICE_ACCOUNT_JSON,
    GCP_SERVICE_ACCOUNT_JSON_valid: false,
    bigquery_import: false,
    bigquery_query: false,
    error: null,
  };

  try {
    JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
    checks.GCP_SERVICE_ACCOUNT_JSON_valid = true;
  } catch (e) {
    checks.error = 'JSON parse failed: ' + e.message;
    return Response.json(checks);
  }

  let BigQuery;
  try {
    const bq = await import('@google-cloud/bigquery');
    BigQuery = bq.BigQuery;
    checks.bigquery_import = true;
  } catch (e) {
    checks.error = 'BigQuery import failed: ' + e.message;
    return Response.json(checks);
  }

  try {
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
    });
    const [rows] = await bigquery.query({ query: 'SELECT 1 AS test', location: 'US' });
    checks.bigquery_query = true;
  } catch (e) {
    checks.error = 'BigQuery query failed: ' + e.message;
  }

  return Response.json(checks);
}
