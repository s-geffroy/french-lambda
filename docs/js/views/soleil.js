import { esc } from "../fiche.js";
import { legende } from "./journee.js";

// Soleil : poste de vie -> catégorie -> contrôleur ultime -> marque.
// Cliquer un secteur zoome dessus ; le centre remonte d'un niveau.
export function render(el, brands, ctx) {
  const { model } = ctx;
  el.innerHTML = `<h2>Soleil des postes de vie</h2>
    <p class="intro">De l'intérieur vers l'extérieur : poste de vie, catégorie, groupe qui contrôle, marque. La taille d'un secteur est son nombre de marques. Cliquer pour zoomer, cliquer le centre pour remonter.</p>
    ${legende(ctx)}<p class="fil muted"></p><div class="zone"></div>`;
  if (!brands.length) return;

  const tree = d3.group(brands, (b) => b.macroObj?.id || "?", (b) => b.categorie, (b) => b.top.id);
  const root = d3.hierarchy(tree).sum((d) => (d.marque ? 1 : 0))
    .sort((a, b) => b.value - a.value);
  const name = (d) => {
    if (d.data.marque) return d.data.marque;
    const k = d.data[0];
    if (d.depth === 1) return model.macro.get(k)?.label || k;
    if (d.depth === 2) return model.cat.get(k)?.label || k;
    if (d.depth === 3) return model.g.get(k)?.nom || k;
    return "Tout";
  };
  const macroOf = (d) => d.ancestors().find((a) => a.depth === 1)?.data[0];

  const W = Math.min(el.clientWidth - 32, 820);
  const R = W / 6;
  d3.partition().size([2 * Math.PI, root.height + 1])(root);
  root.each((d) => (d.current = d));

  const arc = d3.arc().startAngle((d) => d.x0).endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004)).padRadius(R * 1.5)
    .innerRadius((d) => d.y0 * R).outerRadius((d) => Math.max(d.y0 * R, d.y1 * R - 2));
  const svg = d3.select(el.querySelector(".zone")).append("svg")
    .attr("viewBox", [-W / 2, -W / 2, W, W]).attr("width", W).attr("height", W)
    .attr("role", "img").attr("aria-label", "Diagramme en soleil des marques par poste de vie");

  const visible = (d) => d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  const labelOk = (d) => d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.06;
  const path = svg.append("g").selectAll("path").data(root.descendants().slice(1)).join("path")
    .style("fill", (d) => ctx.color(macroOf(d)))
    .attr("fill-opacity", (d) => (visible(d.current) ? [0, 1, 0.75, 0.5, 0.35][d.depth] : 0))
    .attr("pointer-events", (d) => (visible(d.current) ? "auto" : "none"))
    .attr("d", (d) => arc(d.current))
    .style("cursor", "pointer")
    .on("mousemove", (e, d) => ctx.tip.show(e, `<b>${esc(name(d))}</b>${d.ancestors().slice(1, -1).reverse().map((a) => esc(name(a))).join(" › ")}${d.depth < 4 ? `<br>${d.value} marque${d.value > 1 ? "s" : ""}` : ""}`))
    .on("mouseleave", () => ctx.tip.hide())
    .on("click", (e, d) => {
      if (d.data.marque) return ctx.select("m:" + d.data.id);
      if (d.depth === 3 && !d.children?.length) return;
      zoom(d);
    });

  const label = svg.append("g").attr("pointer-events", "none").attr("text-anchor", "middle")
    .selectAll("text").data(root.descendants().slice(1)).join("text")
    .attr("dy", "0.35em").style("fill", "var(--ink)")
    .attr("fill-opacity", (d) => +labelOk(d.current))
    .attr("transform", (d) => tf(d.current))
    .text((d) => trunc(name(d), 16));

  const centre = svg.append("circle").attr("r", R).style("fill", "var(--surface)").style("cursor", "pointer")
    .on("click", () => zoom(cur.parent || root));
  const centreTxt = svg.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").style("fill", "var(--ink)").style("font-size", "13px");
  let cur = root;
  majCentre();

  function zoom(p) {
    cur = p;
    root.each((d) => (d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth),
    }));
    const t = svg.transition().duration(600);
    path.transition(t).tween("data", (d) => { const i = d3.interpolate(d.current, d.target); return (tt) => (d.current = i(tt)); })
      .filter(function (d) { return +this.getAttribute("fill-opacity") || visible(d.target); })
      .attr("fill-opacity", (d) => (visible(d.target) ? [0, 1, 0.75, 0.5, 0.35][d.depth] : 0))
      .attr("pointer-events", (d) => (visible(d.target) ? "auto" : "none"))
      .attrTween("d", (d) => () => arc(d.current));
    label.filter(function (d) { return +this.getAttribute("fill-opacity") || labelOk(d.target); }).transition(t)
      .attr("fill-opacity", (d) => +labelOk(d.target)).attrTween("transform", (d) => () => tf(d.current));
    majCentre();
  }
  function majCentre() {
    centreTxt.text(cur === root ? `${root.value} marques` : trunc(name(cur), 18));
    el.querySelector(".fil").textContent = cur.ancestors().reverse().map(name).join(" › ");
  }
  function tf(d) {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * R;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
