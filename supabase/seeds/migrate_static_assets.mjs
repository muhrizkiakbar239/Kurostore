import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const bucket = 'kurostore-assets';
const imagesDirectory = path.resolve('public', 'images');
const publicDirectory = path.resolve('public');
const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};
const objectName = (name) => name
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: manifestPreflightError } = await supabase
  .from('asset_files')
  .select('id')
  .limit(1);
if (manifestPreflightError) {
  throw new Error(
    'Asset migration belum diterapkan. Jalankan supabase/migrations/20261119160000_asset_storage.sql di Supabase SQL Editor, lalu jalankan script ini lagi.',
  );
}

const { data: bucketRow, error: bucketError } = await supabase.storage
  .from(bucket)
  .list('', { limit: 1 });

if (bucketError) {
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  });
  if (createError) throw new Error(`Unable to create assets bucket: ${createError.message}`);
} else {
  const { error: updateError } = await supabase.storage.updateBucket(bucket, {
    public: true,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  });
  if (updateError) throw new Error(`Unable to configure assets bucket: ${updateError.message}`);
}

const files = (await readdir(imagesDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile());

const replacements = new Map();
let uploaded = 0;

for (const entry of files) {
  const extension = path.extname(entry.name).toLowerCase();
  const mimeType = mimeTypes[extension];
  if (!mimeType) continue;

  const sourcePath = path.join(imagesDirectory, entry.name);
  const body = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(body).digest('hex');
  const destinationName = objectName(entry.name);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(destinationName, body, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: true,
    });
  if (uploadError) throw new Error(`Unable to upload ${entry.name}: ${uploadError.message}`);

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(destinationName);
  const publicUrl = publicData.publicUrl;

  const { error: manifestError } = await supabase
    .from('asset_files')
    .upsert({
      bucket,
      object_path: destinationName,
      original_name: entry.name,
      public_url: publicUrl,
      mime_type: mimeType,
      byte_size: body.length,
      sha256,
    }, { onConflict: 'bucket,object_path' });
  if (manifestError) throw new Error(`Unable to record ${entry.name}: ${manifestError.message}`);

  replacements.set(entry.name, publicUrl);
  uploaded++;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'images') continue;
      paths.push(...await walk(fullPath));
    } else if (entry.isFile() && /(\.(html|js|css))$/i.test(entry.name)) {
      paths.push(fullPath);
    }
  }
  return paths;
}

let replacedReferences = 0;
for (const filePath of await walk(publicDirectory)) {
  let content = await readFile(filePath, 'utf8');
  for (const [originalName, publicUrl] of replacements) {
    const escapedName = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`(?:\\.\\./)+images/${escapedName}(?:\\?[^"'\\s]*)?`, 'g'),
      new RegExp(`(?:\\.?/)?images/${escapedName}(?:\\?[^"'\\s]*)?`, 'g'),
    ];
    for (const pattern of patterns) {
      const count = (content.match(pattern) ?? []).length;
      if (count > 0) {
        content = content.replace(pattern, publicUrl);
        replacedReferences += count;
      }
    }
  }
  await writeFile(filePath, content);
}

console.log(`Uploaded ${uploaded} assets to Supabase Storage.`);
console.log(`Replaced ${replacedReferences} frontend references.`);
