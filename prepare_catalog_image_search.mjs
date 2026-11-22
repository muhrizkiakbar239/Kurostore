import fs from "node:fs";

const catalog = JSON.parse(
  fs.readFileSync("./kuromart_catalog_200.json", "utf8")
);

const products = Object.entries(catalog.categories).flatMap(
  ([category, names]) =>
    names.map(name => ({ category, name }))
);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function searchCommons(name) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${name}`,
    gsrlimit: "3",
    gsrsort: "relevance",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "400",
    format: "json",
    origin: "*"
  });

  try {
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      { headers: { "User-Agent": "KUROMARTCatalogReview/1.0" } }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const pages = Object.values(data.query?.pages || {});

    return pages.map(page => {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata || {};

      return {
        title: page.title,
        image: info?.thumburl || info?.url || "",
        original: info?.url || "",
        page: info?.descriptionurl || "",
        license: meta.LicenseShortName?.value || "Unknown",
        artist: meta.Artist?.value || "",
        source: "Wikimedia Commons"
      };
    }).filter(x => x.image);
  } catch (error) {
    console.log("Gagal:", name, error.message);
    return [];
  }
}

const results = [];

for (let i = 0; i < products.length; i++) {
  const product = products[i];
  console.log(`${i + 1}/${products.length}: ${product.name}`);

  const candidates = await searchCommons(product.name);

  results.push({
    ...product,
    candidates,
    selected: null
  });

  await sleep(350);
}

fs.mkdirSync("./catalog-review", { recursive: true });

fs.writeFileSync(
  "./catalog-review/candidates.json",
  JSON.stringify(results, null, 2),
  "utf8"
);

const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KUROMART Image Review</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f5f6fa;color:#20232a;font-family:Arial,sans-serif}
header{background:#fff;padding:20px;position:sticky;top:0;z-index:5;border-bottom:1px solid #ddd}
main{max-width:1200px;margin:auto;padding:20px}
input{padding:12px;width:100%;border:1px solid #ddd;border-radius:8px;margin:12px 0}
.card{background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0}
.candidates{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.candidate{border:2px solid transparent;padding:8px;border-radius:10px}
.candidate.selected{border-color:#2563eb;background:#eff6ff}
.candidate img{width:100%;height:220px;object-fit:contain;background:#f3f4f6}
button{padding:10px 14px;border:0;border-radius:8px;cursor:pointer;background:#2563eb;color:white}
button.secondary{background:#e5e7eb;color:#222}
small{display:block;margin:6px 0;color:#666;overflow-wrap:anywhere}
.status{font-weight:bold}
.top{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
@media(max-width:600px){main{padding:10px}.candidate img{height:170px}}
</style>
</head>
<body>
<header>
<h2>KUROMART Image Review</h2>
<div class="top">
<span id="progress">0 dipilih</span>
<button id="export">Ekspor pilihan JSON</button>
<button class="secondary" id="clear">Reset pilihan</button>
</div>
<input id="filter" placeholder="Cari produk atau kategori...">
</header>
<main id="list"></main>
<script>
const data = ${JSON.stringify(results)};
const selections = {};
const list = document.getElementById("list");

function render(){
  const q = document.getElementById("filter").value.toLowerCase();
  list.innerHTML = "";

  data.forEach((p, i) => {
    if(!((p.name+" "+p.category).toLowerCase().includes(q))) return;

    const card = document.createElement("section");
    card.className = "card";

    const heading = document.createElement("h3");
    heading.textContent = (i+1)+". "+p.name+" — "+p.category;
    card.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "candidates";

    if(!p.candidates.length){
      const msg = document.createElement("p");
      msg.textContent = "Tidak ada kandidat. Coba pencarian manual.";
      card.appendChild(msg);
    }

    p.candidates.forEach((c, j) => {
      const box = document.createElement("div");
      box.className = "candidate"+(selections[i]===j?" selected":"");

      const img = document.createElement("img");
      img.src = c.image;
      img.alt = p.name;
      img.loading = "lazy";

      const title = document.createElement("small");
      title.textContent = c.title;

      const license = document.createElement("small");
      license.textContent = "Lisensi: "+c.license;

      const link = document.createElement("a");
      link.href = c.page;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Lihat sumber";

      const button = document.createElement("button");
      button.textContent = selections[i]===j?"Terpilih":"Pilih gambar";
      button.onclick = () => {
        selections[i] = j;
        render();
      };

      box.append(img,title,license,link,button);
      grid.appendChild(box);
    });

    card.appendChild(grid);
    list.appendChild(card);
  });

  document.getElementById("progress").textContent =
    Object.keys(selections).length+" produk dipilih";
}

document.getElementById("filter").oninput = render;

document.getElementById("clear").onclick = () => {
  if(confirm("Hapus semua pilihan gambar?")){
    Object.keys(selections).forEach(k=>delete selections[k]);
    render();
  }
};

document.getElementById("export").onclick = () => {
  const approved = Object.entries(selections).map(([i,j]) => {
    const p = data[Number(i)];
    return {
      category:p.category,
      name:p.name,
      selected:p.candidates[j]
    };
  });

  const blob = new Blob(
    [JSON.stringify(approved,null,2)],
    {type:"application/json"}
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kuromart-approved-images.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

render();
</script>
</body>
</html>`;

fs.writeFileSync(
  "./catalog-review/image-review.html",
  html,
  "utf8"
);

console.log("Selesai:", results.length, "produk.");
console.log("Review: catalog-review/image-review.html");
