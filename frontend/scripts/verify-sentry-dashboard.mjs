/**
 * Confirm a Sentry event ID is visible in the project issue stream (requires SENTRY_AUTH_TOKEN).
 * Run: node frontend/scripts/verify-sentry-dashboard.mjs <eventId>
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const eventId = process.argv[2];
const authToken = process.env.SENTRY_AUTH_TOKEN;
const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;

if (!authToken) {
  console.error('SENTRY_AUTH_TOKEN not set in .env — add a User Auth Token with project:read');
  process.exit(1);
}
if (!eventId || !dsn) {
  console.error('Usage: node verify-sentry-dashboard.mjs <eventId>  (SENTRY_DSN in .env)');
  process.exit(1);
}

function parseDsn(dsnUrl) {
  const u = new URL(dsnUrl);
  const projectId = u.pathname.replace(/^\//, '');
  const region = u.hostname.includes('us.sentry') ? 'us.sentry.io' : 'sentry.io';
  return { projectId, region };
}

const { projectId, region } = parseDsn(dsn);

async function api(pathname) {
  const res = await fetch(`https://${region}/api/0${pathname}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const orgs = await api('/organizations/');
const org = orgs[0];
const projects = await api(`/organizations/${org.slug}/projects/`);
const project = projects.find((p) => String(p.id) === String(projectId)) ?? projects[0];

const event = await api(`/projects/${org.slug}/${project.slug}/events/${eventId}/`);

console.log('=== Sentry dashboard confirmation ===');
console.log('Organization:', org.slug, `(${org.name})`);
console.log('Project:', project.slug, `(id ${project.id})`);
console.log('Event ID:', eventId);
console.log('Title:', event.title);
console.log('Level:', event.tags?.find?.((t) => t.key === 'level')?.value ?? event.type);
console.log('Environment:', event.tags?.find?.((t) => t.key === 'environment')?.value ?? '(none)');
console.log('Tags:', (event.tags ?? []).map((t) => `${t.key}=${t.value}`).join(', '));
console.log('Timestamp:', event.dateCreated ?? event.dateReceived);
console.log(
  'Dashboard URL:',
  `https://${region.replace('.io', '')}.io/organizations/${org.slug}/issues/?query=${eventId}`,
);
console.log('\nExtra (stored payload):');
console.log(JSON.stringify(event.context ?? event.entries ?? event, null, 2).slice(0, 2000));
