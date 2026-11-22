import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync("./catalog-review/candidates.json", "utf8")
);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KUROMART — Image Review</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f4f5f7;color:#20232a;font-family:Arial,sans-serif}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:16px 20px;z-index:5}
header h1{font-size:20px;margin:0 0 8px}
header p{margin:0;color:#666;font-size:13px}
main{max-width:1200px;margin:auto;padding:20px}
.product{background:white;border:1px solid #e3e5e8;border-radius:12px;padding:16px;margin-bottom:20px}
.product h2{font-size:17px;margin:0 0 5px}
.meta{font-size:12px;color:#777;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.item{border:1px solid #ddd;border-radius:10px;overflow:hidden;background:white}
.item:has(input:checked){border:2px solid #1677ff}
.item img{width:100%;height:180px;object-fit:contain;background:#f8f8f8}
.info{padding:10px}
.info p{font-size:12px;line-height:1.5;overflow-wrap:anywhere}
label{display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:bold}
a{font-size:12px;color:#1769aa}
.empty{padding:20px;background:#fff3e0;border-radius:8px;color:#8a5310}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
button{padding:12px 16px;border:0;border-radius:8px;background:#20232a;color:white;cursor:pointer;font-weight:bold}
button.secondary{background:#e5e7eb;color:#222}
button:hover{opacity:.85}
@media(max-width:600px){main{padding:12px}.grid{grid-template-columns:1fr 1fr}.item img{height:140px}}
</style>
</head>
<body>
<header>
<h1>KUROMART — Review Foto Produk</h1>
<p id="progress"></p>
</header>
<main>
<div class="actions">
<button id="export">Ekspor Pilihan</button>
<button class="secondary" id="clear">Reset Pilihan</button>
</div>
<div id="products"></div>
</main>
<script>
const products = ${JSON.stringify(data)};
const selections = {};
const container = document.getElementById("products");

products.forEach((p,index)=>{
  const section=document.createElement("section");
  section.className="product";

  const title=document.createElement("h2");
  title.textContent=(index+1)+". "+p.name;

  const meta=document.createElement("div");
  meta.className="meta";
  meta.textContent=p.category+" • "+(p.candidates?.length||0)+" kandidat";

  section.append(title,meta);

  if(!p.candidates?.length){
    const empty=document.createElement("div");
    empty.className="empty";
    empty.textContent="Tidak ada kandidat. Perlu pencarian alternatif.";
    section.append(empty);
  }else{
    const grid=document.createElement("div");
    grid.className="grid";

    p.candidates.forEach((c,j)=>{
      const card=document.createElement("div");
      card.className="item";

      const img=document.createElement("img");
      img.loading="lazy";
      img.src=c.image;
      img.alt=c.title;
      img.onerror=()=>{img.alt="Gambar gagal dimuat";};

      const info=document.createElement("div");
      info.className="info";

      const label=document.createElement("label");
      const radio=document.createElement("input");
      radio.type="radio";
      radio.name="product_"+index;
      radio.value=j;

      radio.addEventListener("change",()=>{
        selections[index]=j;
        updateProgress();
      });

      label.append(radio,document.createTextNode("Pilih gambar ini"));

      const description=document.createElement("p");
      description.textContent=c.title;

      const license=document.createElement("p");
      license.textContent="Lisensi: "+c.license;

      const link=document.createElement("a");
      link.href=c.page;
      link.target="_blank";
      link.rel="noopener";
      link.textContent="Lihat halaman sumber";

      info.append(label,description,license,link);
      card.append(img,info);
      grid.append(card);
    });

    section.append(grid);
  }

  container.append(section);
});

function updateProgress(){
  document.getElementById("progress").textContent=
    Object.keys(selections).length+" produk dipilih dari "+products.length;
}

document.getElementById("export").onclick=()=>{
  const approved=products.map((p,i)=>({
    category:p.category,
    name:p.name,
    candidates:p.candidates||[],
    selected:selections[i]!==undefined
      ? p.candidates[selections[i]]
      : null
  }));

  const blob=new Blob([JSON.stringify(approved,null,2)],{
    type:"application/json"
  });

  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="kuromart-approved-images.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};

document.getElementById("clear").onclick=()=>{
  if(!confirm("Reset seluruh pilihan gambar?"))return;
  Object.keys(selections).forEach(k=>delete selections[k]);
  document.querySelectorAll('input[type="radio"]').forEach(r=>r.checked=false);
  updateProgress();
};

updateProgress();
</script>
</body>
</html>`;

fs.writeFileSync("./catalog-review/image-review.html",html,"utf8");
console.log("Halaman review berhasil dibuat.");
