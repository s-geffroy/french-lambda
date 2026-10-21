import { esc } from "../fiche.js";
import { paysLabel } from "../data.js";

const TOP = 30;

// Sankey : poste de vie -> contrôleur ultime -> pays de contrôle.
export function render(el, brands, ctx) {
  const { model } = ctx;
  el.innerHTML = `<h2>Du quotidien au capital</h2>
    <p class="intro">À gauche, les postes de vie ; au milieu, les ${TOP} groupes qui contrôlent le plus de marques (les autres regroupés) ; à droite, le pays d'où ce contrôle s'exerce. L'épaisseur d'un flux est un nombre de marques.</p>
    <div class="zone scroll-x"></div>`;
  if (!brands.length) return;

  const parTop = d3.rollup(brands, (v) => v.length, (b) => b.top.id);
  const garde = new Set([...parTop].sort((a, b) => b[1] - a[1]).slice(0, TOP).map((d) => d[0]));
  const mid = (b) => (garde.has(b.top.id) ? "g:" + b.top.id : "g:autres");

  const nodes = new Map();
  const node = (id, name, col, extra = {}) => nodes.get(id) || (nodes.set(id, { id, name, col, ...extra }), nodes.get(id));
  const agg = new Map();
  const bump = (s, t, macro) => {
    const k = s + "|" + t + "|" + macro;
    agg.set(k, (agg.get(k) || 0) + 1);
  };
  for (const b of brands) {
    const m = b.macroObj?.id || "?";
    node("p:" + m, model.macro.get(m)?.label || m, 0, { macro: m });
    const g = mid(b);
    node(g, g === "g:autres" ? "Autres groupes" : b.top.nom, 1, { sel: g === "g:autres" ? null : g });
    node("c:" + b.pays, paysLabel(b.pays), 2);
    bump("p:" + m, g, m);
    bump(g, "c:" + b.pays, m);
  }
  const links = [...agg].map(([k, value]) => {
    const [source, target, macro] = k.split("|");
    return { source, target, value, macro };
  });

  const W = Math.max(720, el.clientWidth - 32);
  const H = Math.max(560, nodes.size * 14);
  const sankey = d3.sankey().nodeId((d) => d.id).nodeWidth(10).nodePadding(6)
    .nodeAlign(d3.sankeyJustify).extent([[1, 6], [W - 1, H - 6]]);
  const { nodes: N, links: L } = sankey({ nodes: [...nodes.values()].map((d) => ({ ...d })), links });

  const svg = d3.select(el.querySelector(".zone")).append("svg").attr("viewBox", [0, 0, W, H]).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Flux des postes de vie vers les groupes et pays de contrôle");
  const lk = svg.append("g").attr("fill", "none").selectAll("path").data(L).join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .style("stroke", (d) => ctx.color(d.macro)).attr("stroke-opacity", 0.35)
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .on("mousemove", (e, d) => ctx.tip.show(e, `<b>${esc(d.source.name)} → ${esc(d.target.name)}</b>${d.value} marque${d.value > 1 ? "s" : ""}`))
    .on("mouseleave", () => ctx.tip.hide());
  svg.append("g").selectAll("rect").data(N).join("rect")
    .attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("width", (d) => d.x1 - d.x0)
    .attr("rx", 2)
    .style("fill", (d) => (d.macro ? ctx.color(d.macro) : "var(--ink-2)"))
    .style("cursor", (d) => (d.sel ? "pointer" : null))
    .on("mouseenter", (e, d) => lk.attr("stroke-opacity", (l) => (l.source === d || l.target === d ? 0.7 : 0.08)))
    .on("mousemove", (e, d) => ctx.tip.show(e, `<b>${esc(d.name)}</b>${d.value} marque${d.value > 1 ? "s" : ""}`))
    .on("mouseleave", () => { lk.attr("stroke-opacity", 0.35); ctx.tip.hide(); })
    .on("click", (e, d) => d.sel && ctx.select(d.sel));
  svg.append("g").selectAll("text").data(N).join("text")
    .attr("x", (d) => (d.x0 < W / 2 ? d.x1 + 6 : d.x0 - 6)).attr("y", (d) => (d.y1 + d.y0) / 2).attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < W / 2 ? "start" : "end"))
    .style("fill", "var(--ink)")
    .text((d) => (d.y1 - d.y0 >= 8 ? `${d.name} (${d.value})` : ""));
}
