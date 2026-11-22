import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

try { process.loadEnvFile('.env.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXABAY_API_KEY, PEXELS_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || (!PIXABAY_API_KEY && !PEXELS_API_KEY)) {
  throw new Error('Set Supabase credentials and at least one image API key (Pixabay or Pexels) in .env.local.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const bucket = process.env.PRODUCT_IMAGE_BUCKET || 'product-images';
const root = path.resolve('public/images/products/catalog');
const seenHashes = new Set();
const seenIds = new Set();
const stop = new Set(['produk','basic','daily','classic','minimal','minimalis','casual','portable','compact','universal','adjustable','set','paket','untuk','dengan','dan','the','a','of','in','size','piece','warna','harian','premium','natural','modern','serbaguna','pria','wanita']);
const synonyms = {
  kaos:'t shirt', kemeja:'shirt', hoodie:'hooded sweatshirt', jaket:'jacket', celana:'pants trousers',
  jeans:'denim', sepatu:'shoes footwear', sandal:'sandals', tas:'bag', dompet:'wallet', topi:'cap hat',
  kopi:'coffee', teh:'tea', biskuit:'cookie biscuit', cokelat:'chocolate', madu:'honey', keripik:'chips',
  bubuk:'powder', sereal:'cereal', sabun:'soap', sampo:'shampoo', handuk:'towel', lampu:'lamp',
  rak:'shelf', keranjang:'basket', gelas:'glass cup', botol:'bottle', kabel:'cable', charger:'charger',
  headset:'headphones', earbud:'earbuds', keyboard:'keyboard', mouse:'computer mouse', speaker:'speaker',
  router:'wifi router', gamepad:'game controller', puzzle:'jigsaw puzzle', kuas:'paint brushes',
  miniatur:'miniature', mug:'mug', stiker:'stickers', poster:'poster', pouch:'pouch', organizer:'organizer',
  sprei:'bedsheet', bantal:'pillow', diffuser:'aroma diffuser', vas:'vase', payung:'umbrella', syal:'scarf',
  sisir:'comb', seprai:'bedsheet', sandal:'sandals', sepatu:'shoes'
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function tokens(s) { return [...new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2&&!stop.has(x)))]; }
function queries(name) {
  const raw = tokens(name);
  const translated = raw.flatMap(t => synonyms[t] ? synonyms[t].split(' ') : [t]);
  const q1 = [...new Set(translated)].slice(0,8).join(' ');
  const q2 = [...new Set(raw)].join(' ');
  return [...new Set([q1,q2])].filter(Boolean);
}
function score(name, tags) {
  const wanted=tokens(name); const available=new Set(tokens(tags));
  const match=wanted.filter(t=>available.has(t)||(synonyms[t]||'').split(' ').some(x=>available.has(x)));
  return wanted.length ? match.length/Math.min(wanted.length,4) : 0;
}
async function requestWithRetry(url, options={}, source='HTTP') {
  for(let attempt=0;attempt<4;attempt++) {
    const r=await fetch(url,options);
    if(r.ok) return r;
    if((r.status===429||r.status>=500)&&attempt<3) { await delay(1500*(attempt+1)); continue; }
    throw new Error(`${source} HTTP ${r.status}`);
  }
  throw new Error(`${source} retries exhausted`);
}
async function pixabaySearch(query) {
  const url=`https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=all&safesearch=true&per_page=20`;
  return (await requestWithRetry(url,{},'Pixabay')).json().then(x=>x.hits||[]);
}
async function pexelsSearch(query) {
  if(!PEXELS_API_KEY) return [];
  const url=`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20`;
  const json=await (await requestWithRetry(url,{headers:{Authorization:PEXELS_API_KEY}},'Pexels')).json();
  return (json.photos||[]).map(p=>({id:`pexels-${p.id}`,tags:p.alt||query,url:p.src?.large||p.src?.medium,score:score(query,p.alt||'')}));
}
async function getCandidates(query) {
  const all=[];
  if(PIXABAY_API_KEY) try { all.push(...(await pixabaySearch(query)).map(h=>({id:String(h.id),tags:h.tags||'',url:h.largeImageURL||h.webformatURL,source:'Pixabay'}))); } catch(e) { console.warn('Pixabay search:',e.message); }
  if(PEXELS_API_KEY) try { all.push(...await pexelsSearch(query)); } catch(e) { console.warn('Pexels search:',e.message); }
  return all;
}
const {data:products,error}=await supabase.from('products').select('id,name,image_url').eq('status','active');
if(error) throw error;
if(!products?.length) throw new Error('No active products found.');
let success=0, already=0; const failures=[];
for(let i=0;i<products.length;i++) {
  const product=products[i];
  try {
    // Keep product images already hosted in this project's bucket.
    if(product.image_url?.includes(`/storage/v1/object/public/${bucket}/catalog/`)) {
      already++; console.log(`KEEP [${i+1}/${products.length}] ${product.name}: existing storage image`); continue;
    }
    let ranked=[];
    for(const query of queries(product.name)) {
      const candidates=await getCandidates(query);
      ranked.push(...candidates.map(h=>({...h,score:score(product.name,h.tags||query)})));
      await delay(1200);
      if(ranked.some(x=>x.score>=0.50&&!seenIds.has(String(x.id)))) break;
    }
    ranked.sort((a,b)=>b.score-a.score);
    const chosen=ranked.find(x=>x.score>=0.50&&!seenIds.has(String(x.id)));
    if(!chosen) { failures.push(`${product.name}: no confident unique match`); console.log(`SKIP [${i+1}/${products.length}] ${product.name}: low confidence`); continue; }
    const imageResponse=await requestWithRetry(chosen.url,{},chosen.source+' image');
    const type=imageResponse.headers.get('content-type')||'';
    if(!type.startsWith('image/')) throw new Error('response is not an image');
    const bytes=Buffer.from(await imageResponse.arrayBuffer());
    if(bytes.length<5000||bytes.length>12_000_000) throw new Error('image size out of range');
    const hash=createHash('sha256').update(bytes).digest('hex');
    if(seenHashes.has(hash)) throw new Error('duplicate image detected');
    seenHashes.add(hash); seenIds.add(String(chosen.id));
    const ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';
    const fileName=`${product.id}.${ext}`;
    await mkdir(root,{recursive:true}); await writeFile(path.join(root,fileName),bytes);
    const storagePath=`catalog/${fileName}`;
    const {error:uploadError}=await supabase.storage.from(bucket).upload(storagePath,bytes,{contentType:type,upsert:true});
    if(uploadError) throw uploadError;
    const {data:publicUrl}=supabase.storage.from(bucket).getPublicUrl(storagePath);
    const {error:updateError}=await supabase.from('products').update({image_url:publicUrl.publicUrl}).eq('id',product.id);
    if(updateError) throw updateError;
    success++; console.log(`OK [${i+1}/${products.length}] ${product.name} (${chosen.source}, match ${chosen.score.toFixed(2)})`);
    await delay(1200);
  } catch(e) { failures.push(`${product.name}: ${e.message}`); console.error(`FAILED [${i+1}/${products.length}] ${product.name}: ${e.message}`); await delay(1500); }
}
console.log(`Finished: ${success} uploaded, ${already} kept, ${failures.length} skipped/failed, ${products.length} total.`);
if(failures.length) console.log('Skipped/failed products:\\n'+failures.join('\\n'));
console.log('Keyword matching is a filter only; visually verify product-image relevance.');
