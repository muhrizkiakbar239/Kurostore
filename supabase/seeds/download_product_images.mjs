import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pixabayKey = process.env.PIXABAY_API_KEY;
if (!supabaseUrl || !serviceRoleKey || !pixabayKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PIXABAY_API_KEY in .env.local.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const bucket = process.env.PRODUCT_IMAGE_BUCKET || 'product-images';
const localRoot = path.resolve('public/images/products');
const seenHashes = new Set();
const seenImageIds = new Set();

const { data: products, error } = await supabase.from('products').select('id,name,image_url,category_id').eq('status','active');
if (error) throw error;
if (!products?.length) throw new Error('No active products returned.');

async function searchPixabay(name) {
  const query = encodeURIComponent(name);
  const url = `https://pixabay.com/api/?key=${pixabayKey}&q=${query}&image_type=photo&orientation=all&safesearch=true&per_page=10`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pixabay search HTTP ${response.status}`);
  const data = await response.json();
  return data.hits || [];
}

async function downloadUnique(hit) {
  const source = hit.largeImageURL || hit.webformatURL;
  if (!source) return null;
  const response = await fetch(source);
  if (!response.ok) return null;
  const type = response.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 5000 || bytes.length > 12_000_000) return null;
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (seenHashes.has(hash) || seenImageIds.has(hit.id)) return null;
  seenHashes.add(hash);
  seenImageIds.add(hit.id);
  return { bytes, hash, type };
}

let success = 0;
const failures = [];
for (const product of products) {
  try {
    const hits = await searchPixabay(product.name);
    let selected = null;
    for (const hit of hits) {
      selected = await downloadUnique(hit);
      if (selected) break;
    }
    if (!selected) { failures.push(product.name); continue; }
    const extension = selected.type.includes('png') ? 'png' : selected.type.includes('webp') ? 'webp' : 'jpg';
    const fileName = `${product.id}.${extension}`;
    const categoryFolder = 'catalog';
    await mkdir(path.join(localRoot, categoryFolder), { recursive: true });
    await writeFile(path.join(localRoot, categoryFolder, fileName), selected.bytes);
    const storagePath = `${categoryFolder}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, selected.bytes, { contentType: selected.type, upsert: true });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const { error: updateError } = await supabase.from('products').update({ image_url: publicUrl.publicUrl }).eq('id', product.id);
    if (updateError) throw updateError;
    success++;
    console.log(`[${success}/${products.length}] ${product.name}`);
  } catch (e) {
    failures.push(`${product.name}: ${e.message}`);
    console.error('FAILED', product.name, e.message);
  }
}
console.log(`Finished: ${success} uploaded, ${failures.length} failed, ${products.length} total.`);
if (failures.length) console.log('Failures:', failures.join('\n'));
