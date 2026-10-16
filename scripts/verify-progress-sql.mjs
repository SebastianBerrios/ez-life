import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const container = 'ez-life-progress-sql';
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}
let started = false;
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=audit-local-only', 'postgres:17-alpine']);
  started = true;
  for (let attempt = 0; attempt < 40; attempt++) {
    const ready = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { windowsHide: true });
    if (ready.status === 0) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const bootstrap = `
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.rls_managed_schemas(schema_name text primary key);
  `;
  const sql = bootstrap
    + readFileSync('supabase/migrations/20260917190158_init_ez_life.sql', 'utf8')
    + readFileSync('supabase/migrations/20261009014333_audit_sync_safety.sql', 'utf8')
    + readFileSync('supabase/migrations/20261009195513_personal_achievements.sql', 'utf8')
    + readFileSync('supabase/audit/personal-achievements.test.sql', 'utf8');
  process.stdout.write(docker(['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql));
  process.stdout.write('Isolated achievement SQL assertions passed.\n');
} finally {
  if (started) docker(['stop', container]);
}
