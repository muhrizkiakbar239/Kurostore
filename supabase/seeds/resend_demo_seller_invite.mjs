import { createClient } from '@supabase/supabase-js';
import { demoSellerSeedMarker } from './demo_seller_stores.mjs';

try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and RESEND_API_KEY must be configured in .env.local.');
}

const optionValue = (name) => {
  const prefix = `${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (argument) return argument.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

const alias = optionValue('--seller-alias')?.trim().toLowerCase();
const baseEmail = optionValue('--base-email')?.trim().toLowerCase();
const expectedProjectRef = optionValue('--expected-project-ref')?.trim();
if (!/^seller(?:0[1-9]|1[0-9]|20)$/.test(alias ?? '')
  || !baseEmail || !expectedProjectRef
  || !process.argv.includes('--confirm-production')) {
  throw new Error('Pass --seller-alias sellerNN, --base-email, --expected-project-ref, and --confirm-production.');
}

const [localPart, emailDomain, extra] = baseEmail.split('@');
if (!localPart || emailDomain !== 'gmail.com' || extra !== undefined) {
  throw new Error('The base address must be a Gmail address.');
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (projectRef !== expectedProjectRef) {
  throw new Error(`Supabase project mismatch: expected ${expectedProjectRef}, configured ${projectRef}. No invitation was sent.`);
}

const sellerNumber = alias.slice('seller'.length);
const email = `${localPart}+${alias}@gmail.com`;
const storeSlug = `kurostore-demo-seller-${sellerNumber}`;
const redirectTo = 'https://www.kurostore.biz.id/pages/accept-invite.html';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const resendCheck = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${resendApiKey}` },
});
if (!resendCheck.ok) {
  throw new Error(`Unable to verify the Resend API key (HTTP ${resendCheck.status}). No invitation link was generated.`);
}

let user = null;
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`Unable to verify the seller account: ${error.message}`);
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
  if (user || data.users.length < 1000) break;
}
if (!user) throw new Error(`Seller account ${alias} does not exist.`);
if (user.app_metadata?.kurostore_demo_seller_seed !== demoSellerSeedMarker
  || user.app_metadata?.kurostore_demo_seller_slug !== storeSlug) {
  throw new Error(`Account ${alias} is not the expected seeded seller.`);
}
if (!user.invited_at || user.app_metadata?.kurostore_invite_accepted === true) {
  throw new Error(`Account ${alias} is not awaiting invitation acceptance.`);
}

const { data: store, error: storeError } = await supabase
  .from('seller_profiles')
  .select('user_id')
  .eq('user_id', user.id)
  .maybeSingle();
if (storeError) throw new Error(`Unable to verify seller store: ${storeError.message}`);
if (!store) throw new Error(`Seller store for ${alias} does not exist.`);

const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: 'invite',
  email,
  options: { redirectTo },
});
if (linkError) throw new Error(`Unable to generate a fresh invitation link: ${linkError.message}`);

const actionLink = linkData.properties.action_link;
const actionUrl = new URL(actionLink);
if (actionUrl.origin !== new URL(supabaseUrl).origin || actionUrl.pathname !== '/auth/v1/verify') {
  throw new Error('Supabase returned an unexpected invitation URL. The link was not sent.');
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);
const safeActionLink = escapeHtml(actionLink);
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'Kurostore <noreply@auth.kurostore.biz.id>',
    to: [email],
    subject: 'Aktifkan akun seller Kurostore',
    html: `<p>Halo,</p><p>Kamu diundang untuk menggunakan akun seller di Kurostore. Klik tautan berikut untuk membuat kata sandi:</p><p><a href="${safeActionLink}">Aktifkan akun seller</a></p><p>Jika kamu tidak meminta undangan ini, abaikan email ini.</p>`,
    text: `Kamu diundang untuk menggunakan akun seller di Kurostore. Buka tautan berikut untuk membuat kata sandi:\n${actionLink}\n\nJika kamu tidak meminta undangan ini, abaikan email ini.`,
  }),
});
if (!response.ok) {
  const errorBody = await response.json().catch(() => null);
  const message = typeof errorBody?.message === 'string' ? errorBody.message : `HTTP ${response.status}`;
  throw new Error(`Unable to send the seller invitation through Resend: ${message}. Rerun this script to generate and send a fresh link.`);
}

console.log(`Fresh seller invitation sent to ${email}. The link was not printed.`);
