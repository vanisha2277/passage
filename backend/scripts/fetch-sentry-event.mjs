/**
 * Fetch a Sentry event by ID via REST API (stored payload, not SDK preview).
 * Run: node backend/scripts/fetch-sentry-event.mjs [eventId]
 * Requires SENTRY_AUTH_TOKEN in root .env (User Auth Token with project:read).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const eventId = process.argv[2];
const authToken = process.env.SENTRY_AUTH_TOKEN;
const dsn = process.env.SENTRY_DSN;

if (!authToken) {
  console.error('SENTRY_AUTH_TOKEN not set — create at https://sentry.io/settings/account/api/auth-tokens/');
  process.exit(1);
}
if (!eventId) {
  console.error('Usage: node fetch-sentry-event.mjs <eventId>');
  process.exit(1);
}

function parseDsn(dsnUrl) {
  const u = new URL(dsnUrl);
  const projectId = u.pathname.replace(/^\//, '');
  const orgHost = u.hostname; // o4511599930048512.ingest.us.sentry.io
  const orgId = orgHost.split('.')[0].replace(/^o/, '');
  const region = orgHost.includes('us.sentry') ? 'us.sentry.io' : 'sentry.io';
  return { projectId, orgId, region };
}

const { projectId, region } = parseDsn(dsn);

async function api(pathname) {
  const res = await fetch(`https://${region}/api/0${pathname}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text}`);
  return JSON.parse(text);
}

const orgs = await api('/organizations/');
const org = orgs[0];
if (!org) throw new Error('No organizations found for token');

const projects = await api(`/organizations/${org.slug}/projects/`);
const project = projects.find((p) => String(p.id) === String(projectId)) ?? projects[0];
if (!project) throw new Error(`Project ${projectId} not found`);

const event = await api(`/projects/${org.slug}/${project.slug}/events/${eventId}/`);

const outPath = path.resolve(__dirname, '../../sentry-event-payload.json');
writeFileSync(outPath, JSON.stringify(event, null, 2));

console.log('Organization:', org.slug);
console.log('Project:', project.slug, `(id ${project.id})`);
console.log('Event title:', event.title);
console.log('Event datetime:', event.dateCreated ?? event.dateReceived);
console.log('Written to:', outPath);
console.log('\n--- FULL STORED EVENT JSON ---\n');
console.log(JSON.stringify(event, null, 2));
