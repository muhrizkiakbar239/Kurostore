import { createClient } from '@supabase/supabase-js';
import { demoSellerSeedMarker, demoSellerStores } from './demo_seller_stores.mjs';

try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
}

const optionValue = (name) => {
  const prefix = `${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (argument) return argument.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

const baseEmail = optionValue('--base-email')?.trim().toLowerCase();
const expectedProjectRef = optionValue('--expected-project-ref')?.trim();
if (!baseEmail || !expectedProjectRef) {
  throw new Error('Pass --base-email and --expected-project-ref. No accounts were changed.');
}

const emailParts = baseEmail.split('@');
if (emailParts.length !== 2 || emailParts[1] !== 'gmail.com' || !emailParts[0]) {
  throw new Error('The base address must be a Gmail address so plus-aliases can receive invitations.');
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (projectRef !== expectedProjectRef) {
  throw new Error(`Supabase project mismatch: expected ${expectedProjectRef}, configured ${projectRef}. No accounts were changed.`);
}

const baseLocalPart = emailParts[0].split('+')[0];
const emails = demoSellerStores.map((_, index) =>
  `${baseLocalPart}+seller${String(index + 1).padStart(2, '0')}@gmail.com`);
if (new Set(emails).size !== demoSellerStores.length) {
  throw new Error('Seller email aliases are not unique.');
}

if (process.argv.includes('--dry-run')) {
  console.log(`Dry run for Supabase project ${projectRef}:`);
  demoSellerStores.forEach((store, index) => {
    console.log(`${emails[index]} -> ${store.storeName}`);
  });
  process.exit(0);
}

if (!process.argv.includes('--confirm-production')) {
  throw new Error('Pass --confirm-production only after verifying the configured project. No accounts were changed.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Unable to check existing seller accounts: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const existingUsers = await listAllUsers();
const usersByEmail = new Map(existingUsers
  .filter((user) => user.email)
  .map((user) => [user.email.toLowerCase(), user]));

const { data: existingStores, error: storesError } = await supabase
  .from('seller_profiles')
  .select('user_id, store_slug')
  .in('store_slug', demoSellerStores.map(({ storeSlug }) => storeSlug));
if (storesError) throw new Error(`Unable to check existing seller stores: ${storesError.message}`);

const storesBySlug = new Map((existingStores ?? []).map((store) => [store.store_slug, store]));

for (let index = 0; index < demoSellerStores.length; index += 1) {
  const store = demoSellerStores[index];
  const user = usersByEmail.get(emails[index]);
  const existingStore = storesBySlug.get(store.storeSlug);
  if (!user && existingStore) {
    throw new Error(`Store slug ${store.storeSlug} is already assigned to an unexpected account. No accounts were changed.`);
  }
  if (user) {
    const metadata = user.app_metadata ?? {};
    const seededAccount = metadata.kurostore_demo_seller_seed === demoSellerSeedMarker
      && metadata.kurostore_demo_seller_slug === store.storeSlug;
    const recoverableAccount = user.user_metadata?.kurostore_demo_seller_seed === demoSellerSeedMarker
      && user.user_metadata?.kurostore_demo_seller_slug === store.storeSlug
      && existingStore?.user_id === user.id;
    if ((!seededAccount && !recoverableAccount)
      || (existingStore && existingStore.user_id !== user.id)) {
      throw new Error(`Email ${emails[index]} already belongs to an account not created by this seed. No accounts were changed.`);
    }
  }
}

let invitedCount = 0;
for (let index = 0; index < demoSellerStores.length; index += 1) {
  const store = demoSellerStores[index];
  const email = emails[index];
  const fullName = `Seller Kurostore ${String(index + 1).padStart(2, '0')}`;
  let user = usersByEmail.get(email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://www.kurostore.biz.id/pages/accept-invite.html',
      data: {
        full_name: fullName,
        kurostore_demo_seller_seed: demoSellerSeedMarker,
        kurostore_demo_seller_slug: store.storeSlug,
      },
    });
    if (typeof error?.message === 'string' && error.message.toLowerCase().includes('rate limit')) {
      throw new Error(`Supabase email rate limit reached while inviting ${email}. Configure custom SMTP or wait for the limit to reset, then rerun this seed; previously completed seller accounts will be reused without another invitation.`);
    }
    if (error) throw new Error(`Unable to invite ${email}: ${error.message}`);
    if (!data.user) throw new Error(`Supabase returned no user for ${email}.`);
    user = data.user;
    invitedCount += 1;
    usersByEmail.set(email, user);
  }

  const appMetadata = {
    ...(user.app_metadata ?? {}),
    kurostore_demo_seller_seed: demoSellerSeedMarker,
    kurostore_demo_seller_slug: store.storeSlug,
  };
  const { error: metadataError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: appMetadata,
  });
  if (metadataError) throw new Error(`Unable to mark seller account ${email}: ${metadataError.message}`);

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, full_name: fullName, role: 'seller' }, { onConflict: 'id' });
  if (profileError) throw new Error(`Unable to set seller role for ${email}: ${profileError.message}`);

  const { error: storeError } = await supabase
    .from('seller_profiles')
    .upsert({
      user_id: user.id,
      store_name: store.storeName,
      store_slug: store.storeSlug,
      store_description: store.storeDescription,
    }, { onConflict: 'user_id' });
  if (storeError) throw new Error(`Unable to save store ${store.storeName}: ${storeError.message}`);
}

const { count, error: verificationError } = await supabase
  .from('seller_profiles')
  .select('user_id', { count: 'exact', head: true })
  .in('store_slug', demoSellerStores.map(({ storeSlug }) => storeSlug));
if (verificationError) throw new Error(`Unable to verify seller stores: ${verificationError.message}`);
if (count !== demoSellerStores.length) {
  throw new Error(`Seller verification failed: expected ${demoSellerStores.length} stores, found ${count ?? 0}.`);
}

console.log(`Verified ${count} seller accounts and stores; sent ${invitedCount} new invitations to ${baseEmail}.`);
