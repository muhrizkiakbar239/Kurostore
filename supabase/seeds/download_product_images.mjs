import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

try { process.loadEnvFile('.env.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXABAY_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PIXABAY_API_KEY) throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PIXABAY_API_KEY in .env.local.');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const bucket = process.env.PRODUCT_IMAGE_BUCKET || 'product-images';
const root = path.resolve('public/images/products/catalog');
const seenHashes = new Set();
const stop = new Set(['produk','basic','daily','classic','minimal','minimalis','casual','portable','compact','universal','adjustable','set','paket','untuk','dengan','dan','the','a','of','in','size','piece','warna','harian','premium','natural','modern','serbaguna']);
const synonyms = {
  'kaos':'t shirt tshirt', 'kemeja':'shirt', 'hoodie':'hooded sweatshirt', 'jaket':'jacket',
  'celana':'pants trousers', 'jeans':'denim jeans', 'sepatu':'shoes footwear', 'sandal':'sandals',
  'tas':'bag', 'dompet':'wallet', 'topi':'cap hat', 'kopi':'coffee', 'teh':'tea',
  'biskuit':'cookie biscuit', 'cokelat':'chocolate', 'madu':'honey', 'keripik':'chips',
  'bubuk':'powder', 'sereal':'cereal', 'sabun':'soap', 'sampo':'shampoo',
  'conditioner':'hair conditioner', 'sunscreen':'sunscreen', 'serum':'serum',
  'handuk':'towel', 'lampu':'lamp', 'rak':'shelf', 'keranjang':'basket',
  'gelas':'glass cup', 'botol':'bottle', 'kabel':'cable', 'charger':'charger',
  'headset':'headphones', 'earbud':'earbuds', 'keyboard':'keyboard', 'mouse':'computer mouse',
  'speaker':'speaker', 'power':'power', 'bank':'battery', 'router':'wifi router',
  'gamepad':'game controller', 'jam':'watch clock', 'puzzle':'jigsaw puzzle',
  'kuas':'paint brushes', 'cat':'paint', 'album':'album', 'miniatur':'miniature',
  'mug':'mug', 'stiker':'stickers', 'poster':'poster', 'pouch':'pouch',
  'organizer':'organizer', 'sprei':'bedsheet', 'bantal':'pillow', 'diffuser':'aroma diffuser',
  'vas':'vase', 'payung':'umbrella', 'syal':'scarf', 'sisir':'comb',
};
function tokens(s) {
  return [...new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x => x.length > 2 && !stop.has(x)))];
}
function queryFor(name) {
  const base = tokens(name);
  const expanded = base.flatMap(t => synonyms[t] ? synonyms[t].split(' ') : [t]);
  return [...new Set(expanded)].slice(0, 8).join(' ');
}
function score(name, tags) {
  const wanted = tokens(name);
  const available = new Set(tokens(tags));
  const matched = wanted.filter(t => available.has(t) || (synonyms[t] || '').split(' ').some(x => available.has(x)));
  return wanted.length ? matched.length / Math.min(wanted.length, 5) : 0;
}
async function search(query) {
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=all&safesearch=true&per_page=20`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Pixabay HTTP ${r.status}`);
  return (await r.json()).hits || [];
}
const { data: products, error } = await supabase.from('products').select('id,name,image_url').eq('status','active');
if (error) throw error;
if (!products?.length) throw new Error('No active products found.');
let success = 0;
const failures = [];
for (let i=0;i<products.length;i++) {
  const product = products[i];
  try {
    const hits = await search(queryFor(product.name));
    const ranked = hits.map(h => ({ hit:h, score:score(product.name,h.tags || '') })).sort((a,b)=>b.score-a.score);
    // Conservative threshold: skip weak text/tag matches rather than assigning an unrelated photo.
    const chosen = ranked.find(x => x.score >= 0.45 && !seenHashes.has(String(x.hit.id)))?.hit;
    if (!chosen) { failures.push(`${product.name}: no sufficiently relevant unique Pixabay match`); console.log(`SKIP [${i+1}/${products.length}] ${product.name}: low match confidence`); continue; }
    const r = await fetch(chosen.largeImageURL || chosen.webformatURL);
    if (!r.ok) throw new Error(`image fetch HTTP ${r.status}`);
    const type = r.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error('not an image response');
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length < 5000 || bytes.length > 12_000_000) throw new Error('image size outside allowed range');
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (seenHashes.has(hash)) throw new Error('duplicate image detected');
    seenHashes.add(hash); seenHashes.add(String(chosen.id));
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const fileName = `${product.id}.${ext}`;
    await mkdir(root,{recursive:true});
    await writeFile(path.join(root,fileName),bytes);
    const storagePath = `catalog/${fileName}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath,bytes,{contentType:type,upsert:true});
    if (uploadError) throw uploadError;
    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const { error: updateError } = await supabase.from('products').update({image_url:publicUrl.publicUrl}).eq('id',product.id);
    if (updateError) throw updateError;
    success++;
    console.log(`OK [${i+1}/${products.length}] ${product.name} (tag-match ${ranked.find(x=>x.hit.id===chosen.id)?.score.toFixed(2)})`);
  } catch(e) { failures.push(`${product.name}: ${e.message}`); console.error(`FAILED [${i+1}/${products.length}]`,product.name,e.message); }
}
console.log(`Finished: ${success} uploaded, ${failures.length} skipped/failed, ${products.length} total.`);
if(failures.length) console.log('Skipped/failed products:\n'+failures.join('\n'));
console.log('Reminder: keyword/tag matching is only a filter, not visual verification.');
