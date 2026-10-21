import { esc } from "../fiche.js?v=dev";
import { paysLabel } from "../data.js?v=dev";

// ISO alpha-2 -> ISO numérique (identifiants de world-atlas).
const NUM = {
  FR: "250", US: "840", DE: "276", GB: "826", CH: "756", NL: "528", BE: "056", IT: "380", ES: "724",
  SE: "752", DK: "208", NO: "578", FI: "246", IE: "372", LU: "442", AT: "040", PT: "620", PL: "616",
  CZ: "203", JP: "392", CN: "156", KR: "410", TW: "158", HK: "344", IN: "356", CA: "124", AU: "036",
  BR: "076", MX: "484", QA: "634", AE: "784", SA: "682", TR: "792", RU: "643", IL: "376", SG: "702",
  ZA: "710", MA: "504", AR: "032", NZ: "554", GR: "300", HU: "348", RO: "642", MC: "492", LI: "438",
  CY: "196", MT: "470", EE: "233", LT: "440", LV: "428", UA: "804", BM: "060", KY: "136", TH: "764",
  MY: "458", ID: "360", VN: "704", PH: "608", CL: "152", CO: "170", EG: "818", NG: "566", KW: "414",
};
const WORLD = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
let world;
let mesure = "pays";

export async function render(el, brands, ctx) {
  el.innerHTML = `<h2>D'où s'exerce le contrôle</h2>
    <p class="intro">Chaque marque est rattachée à un pays : celui du siège de son contrôleur ultime, ou la nationalité de l'actionnaire principal de ce contrôleur (une société cotée française détenue d'abord par un fonds américain bascule alors aux États-Unis). Plus la teinte est foncée, plus le pays pèse dans le quotidien français.</p>
    <p><label>Rattacher chaque marque à : <select name="mesure">
      <option value="pays">Siège du contrôleur ultime</option>
      <option value="paysAct">Nationalité de l'actionnaire principal</option></select></label></p>
    <div class="zone"><p class="muted">Chargement du fond de carte…</p></div><div class="table scroll-x"></div>`;
  const sel = el.querySelector("[name=mesure]");
  sel.value = mesure;
  sel.onchange = () => { mesure = sel.value; render(el, brands, ctx); };
  const cnt = d3.rollups(brands, (v) => v.length, (b) => b[mesure]).sort((a, b) => b[1] - a[1]);
  const total = brands.length || 1;
  el.querySelector(".table").innerHTML = `<table><thead><tr><th>Pays de contrôle</th><th>Marques</th><th>Part</th></tr></thead><tbody>${cnt
    .map(([p, n]) => `<tr data-pays="${esc(p)}" style="cursor:pointer"><td>${esc(paysLabel(p))}</td><td class="num">${n}</td><td class="num">${((100 * n) / total).toFixed(1)} %</td></tr>`)
    .join("")}</tbody></table>`;
  el.querySelector(".table").onclick = (e) => {
    const p = e.target.closest("[data-pays]")?.dataset.pays;
    if (p && mesure === "pays") ctx.goto("liste", { pays: p });
  };

  try {
    world ||= await fetch(WORLD).then((r) => r.json());
  } catch (err) {
    el.querySelector(".zone").innerHTML = `<p class="muted">Fond de carte indisponible (${esc(err.message)}) ; le tableau reste à jour.</p>`;
    return;
  }
  if (!el.isConnected) return;
  const byNum = new Map(cnt.filter(([p]) => NUM[p]).map(([p, n]) => [NUM[p], { p, n }]));
  const countries = topojson.feature(world, world.objects.countries).features.filter((f) => f.id !== "010");
  const W = el.clientWidth - 32;
  const H = Math.round(W * 0.5);
  const proj = d3.geoNaturalEarth1().fitSize([W, H], { type: "FeatureCollection", features: countries });
  const path = d3.geoPath(proj);
  const max = d3.max(cnt, (d) => d[1]) || 1;
  const col = d3.scaleSequentialLog([1, max], d3.interpolateRgb(ctx.css("--seq-lo"), ctx.css("--seq-hi")));

  const zone = el.querySelector(".zone");
  zone.innerHTML = "";
  const svg = d3.select(zone).append("svg").attr("viewBox", [0, 0, W, H]).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Carte des pays de contrôle");
  svg.append("g").selectAll("path").data(countries).join("path")
    .attr("d", path)
    .style("fill", (d) => (byNum.has(d.id) ? col(byNum.get(d.id).n) : "var(--surface-2)"))
    .style("stroke", "var(--surface)").attr("stroke-width", 0.5)
    .style("cursor", (d) => (byNum.has(d.id) ? "pointer" : null))
    .on("mousemove", (e, d) => {
      const v = byNum.get(d.id);
      ctx.tip.show(e, `<b>${esc(d.properties.name)}</b>${v ? `${v.n} marque${v.n > 1 ? "s" : ""} (${((100 * v.n) / total).toFixed(1)} %)` : "Aucune marque"}`);
    })
    .on("mouseleave", () => ctx.tip.hide())
    .on("click", (e, d) => mesure === "pays" && byNum.has(d.id) && ctx.goto("liste", { pays: byNum.get(d.id).p }));

  // Légende de l'échelle (log).
  const lg = svg.append("g").attr("transform", `translate(16,${H - 30})`);
  const steps = d3.range(0, 1.0001, 0.1).map((t) => Math.round(Math.exp(Math.log(max) * t)));
  lg.selectAll("rect").data(steps).join("rect").attr("x", (d, i) => i * 14).attr("width", 14).attr("height", 8).style("fill", (d) => col(Math.max(1, d)));
  lg.append("text").attr("y", 20).text("1");
  lg.append("text").attr("x", steps.length * 14).attr("y", 20).attr("text-anchor", "end").text(max + " marques");
}
