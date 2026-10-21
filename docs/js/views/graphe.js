import { esc } from "../fiche.js";

let avecMarques = null;

// Réseau de propriété : marque -> exploitant -> parents -> actionnaires.
export function render(el, brands, ctx) {
  const { model } = ctx;
  if (avecMarques === null) avecMarques = brands.length <= 400;
  el.innerHTML = `<h2>Graphe de propriété</h2>
    <p class="intro">Qui possède qui. Survoler un nœud isole son voisinage ; cliquer ouvre sa fiche. Molette ou pincement pour zoomer.</p>
    <div class="legende">
      <span><i class="pastille" style="background:var(--muted)"></i>Marque</span>
      <span><i class="pastille" style="background:var(--s1)"></i>Entreprise / filiale</span>
      <span><i class="pastille" style="background:var(--s2)"></i>Contrôleur ultime ou actionnaire</span>
      <label style="margin-left:auto"><input type="checkbox" name="m" ${avecMarques ? "checked" : ""}> Afficher les marques</label>
    </div>
    <div class="zone"></div>`;
  el.querySelector("[name=m]").onchange = (e) => {
    avecMarques = e.target.checked;
    render(el, brands, ctx);
  };

  const nodes = new Map();
  const links = [];
  const add = (id, o) => nodes.get(id) || (nodes.set(id, { id, ...o }), nodes.get(id));
  const tops = new Set(brands.map((b) => b.top.id));
  const gNode = (g) => add("g:" + g.id, { label: g.nom, kind: tops.has(g.id) ? "top" : "groupe", n: model.brandsUnder.get(g.id)?.length || 0, sel: "g:" + g.id });

  for (const b of brands) {
    let prev = null;
    if (avecMarques) prev = add("m:" + b.id, { label: b.marque, kind: "marque", n: 1, sel: "m:" + b.id });
    for (const g of b.chain) {
      const node = gNode(g);
      if (prev) links.push({ source: prev.id, target: node.id });
      prev = node;
    }
  }
  // Actionnaires du sommet de chaque chaîne (ceux qui ne sont pas déjà le parent).
  for (const id of tops) {
    const g = model.g.get(id);
    for (const a of g?.actionnaires || []) {
      if (a.type === "flottant") continue;
      const sid = a.id && model.g.has(a.id) ? "g:" + a.id : "a:" + a.nom;
      const node = a.id && model.g.has(a.id) ? gNode(model.g.get(a.id)) : add(sid, { label: a.nom, kind: "top", n: 0 });
      node.kind = "top";
      links.push({ source: "g:" + id, target: node.id, pct: a.part_pct });
    }
  }
  const uniq = new Map(links.map((l) => [l.source + ">" + l.target, l]));
  const L = [...uniq.values()];
  const N = [...nodes.values()];
  if (!N.length) {
    el.querySelector(".zone").innerHTML = '<p class="muted">Rien à afficher.</p>';
    return;
  }

  const W = el.clientWidth - 32;
  const H = Math.max(520, Math.min(900, innerHeight - 200));
  const r = (d) => (d.kind === "marque" ? 3.5 : 4 + Math.sqrt(d.n) * 1.6);
  const svg = d3.select(el.querySelector(".zone")).append("svg").attr("viewBox", [0, 0, W, H]).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", `Graphe de ${N.length} nœuds`);
  const root = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.2, 8]).on("zoom", (e) => {
    root.attr("transform", e.transform);
    label.style("display", (d) => (showLabel(d, e.transform.k) ? null : "none"));
  }));

  const link = root.append("g").selectAll("line").data(L).join("line")
    .style("stroke", "var(--axis)").attr("stroke-width", (d) => (d.pct ? 0.6 + d.pct / 40 : 0.8));
  const node = root.append("g").selectAll("circle").data(N).join("circle")
    .attr("r", r)
    .style("fill", (d) => (d.kind === "marque" ? "var(--muted)" : d.kind === "top" ? "var(--s2)" : "var(--s1)"))
    .style("stroke", "var(--surface)").attr("stroke-width", 1.5)
    .style("cursor", "pointer");
  const showLabel = (d, k) => d.kind !== "marque" ? d.n >= 6 / k || k > 1.6 : k > 3;
  const label = root.append("g").selectAll("text").data(N).join("text")
    .text((d) => d.label).attr("dx", (d) => r(d) + 3).attr("dy", 4)
    .style("display", (d) => (showLabel(d, 1) ? null : "none"))
    .style("pointer-events", "none");

  const voisins = new Map(N.map((n) => [n.id, new Set([n.id])]));
  for (const l of L) {
    voisins.get(l.source)?.add(l.target);
    voisins.get(l.target)?.add(l.source);
  }
  const focus = (d) => {
    const v = d && voisins.get(d.id);
    node.style("opacity", (n) => (!v || v.has(n.id) ? 1 : 0.12));
    label.style("opacity", (n) => (!v || v.has(n.id) ? 1 : 0.12)).style("display", (n) => (v && v.has(n.id)) || showLabel(n, 1) ? null : "none");
    link.style("opacity", (l) => (!v || (v.has(l.source.id) && v.has(l.target.id) && (l.source.id === d.id || l.target.id === d.id)) ? 1 : 0.06));
  };
  node
    .on("mouseenter", (e, d) => {
      focus(d);
      ctx.tip.show(e, `<b>${esc(d.label)}</b>${d.kind === "marque" ? "Marque" : `${d.n} marque${d.n > 1 ? "s" : ""}`}`);
    })
    .on("mousemove", (e, d) => ctx.tip.show(e, `<b>${esc(d.label)}</b>${d.kind === "marque" ? "Marque" : `${d.n} marque${d.n > 1 ? "s" : ""}`}`))
    .on("mouseleave", () => {
      focus(null);
      ctx.tip.hide();
    })
    .on("click", (e, d) => d.sel && ctx.select(d.sel))
    .call(d3.drag()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = d.fy = null; }));

  const sim = d3.forceSimulation(N)
    .force("link", d3.forceLink(L).id((d) => d.id).distance((l) => (l.source.kind === "marque" ? 14 : 40)).strength(0.7))
    .force("charge", d3.forceManyBody().strength((d) => (d.kind === "marque" ? -12 : -60 - d.n * 2)))
    .force("collide", d3.forceCollide((d) => r(d) + 1.5))
    .force("x", d3.forceX(W / 2).strength(0.04))
    .force("y", d3.forceY(H / 2).strength(0.06))
    .on("tick", () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });
}
