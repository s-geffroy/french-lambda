import { esc } from "../fiche.js?v=dev";

const N = 40;
let critere = "marques";

// Barres horizontales : les groupes les plus présents dans la vie du Français.
export function render(el, brands, ctx) {
  el.innerHTML = `<h2>Classement des groupes</h2>
    <p class="intro">Les ${N} contrôleurs ultimes les plus présents. Un seul indicateur à la fois.</p>
    <p><label>Mesurer : <select name="c">
      <option value="marques">Nombre de marques</option>
      <option value="postes">Nombre de catégories de la vie touchées</option></select></label></p>
    <div class="zone"></div>`;
  const sel = el.querySelector("[name=c]");
  sel.value = critere;
  sel.onchange = () => { critere = sel.value; render(el, brands, ctx); };
  if (!brands.length) return;

  const rows = d3.rollups(brands, (v) => ({ marques: v.length, postes: new Set(v.map((b) => b.categorie)).size, top: v[0].top }), (b) => b.top.id)
    .map(([id, o]) => ({ id, ...o, v: o[critere] }))
    .sort((a, b) => b.v - a.v || a.top.nom.localeCompare(b.top.nom, "fr"))
    .slice(0, N);

  const W = el.clientWidth - 32;
  const lw = Math.min(200, W * 0.38);
  const bh = 18, gap = 4;
  const H = rows.length * (bh + gap) + 24;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.v)]).nice().range([lw, W - 36]);
  const svg = d3.select(el.querySelector(".zone")).append("svg").attr("viewBox", [0, 0, W, H]).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Classement des groupes");
  svg.append("g").attr("transform", `translate(0,${H - 20})`)
    .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
    .call((g) => g.selectAll("line,path").style("stroke", "var(--axis)"));
  svg.append("g").selectAll("line").data(x.ticks(5)).join("line")
    .attr("x1", x).attr("x2", x).attr("y1", 0).attr("y2", H - 20).style("stroke", "var(--grid)");
  const row = svg.append("g").selectAll("g").data(rows).join("g")
    .attr("transform", (d, i) => `translate(0,${i * (bh + gap)})`).style("cursor", "pointer")
    .on("click", (e, d) => ctx.select("g:" + d.id))
    .on("mousemove", (e, d) => ctx.tip.show(e, `<b>${esc(d.top.nom)}</b>${d.marques} marques · ${d.postes} catégories`))
    .on("mouseleave", () => ctx.tip.hide());
  row.append("rect").attr("x", 0).attr("width", W).attr("height", bh + gap).style("fill", "transparent");
  row.append("rect").attr("x", lw).attr("y", 0).attr("height", bh).attr("rx", 4)
    .attr("width", (d) => Math.max(2, x(d.v) - lw)).style("fill", "var(--s1)");
  row.append("text").attr("x", lw - 8).attr("y", bh / 2).attr("dy", "0.35em").attr("text-anchor", "end")
    .style("fill", "var(--ink)").text((d) => (d.top.nom.length > 28 ? d.top.nom.slice(0, 27) + "…" : d.top.nom));
  row.append("text").attr("x", (d) => x(d.v) + 6).attr("y", bh / 2).attr("dy", "0.35em")
    .style("font-variant-numeric", "tabular-nums").text((d) => d.v);
}
