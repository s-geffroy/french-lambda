// Bibliothèques chargées à la demande : la vue d'accueil n'en a pas besoin,
// seules les vues graphiques les attendent.
const URLS = {
  d3: "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
  sankey: "https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js",
  topojson: "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js",
};
const loaded = new Map();

function script(name) {
  if (!loaded.has(name))
    loaded.set(
      name,
      new Promise((ok, ko) => {
        const s = document.createElement("script");
        s.src = URLS[name];
        s.onload = ok;
        s.onerror = () => {
          loaded.delete(name);
          ko(new Error(`bibliothèque ${name} indisponible`));
        };
        document.head.append(s);
      })
    );
  return loaded.get(name);
}

// d3-sankey s'appuie sur d3 : il passe après.
export async function need(...names) {
  if (names.some((n) => n !== "topojson")) await script("d3");
  await Promise.all(names.filter((n) => n !== "d3").map(script));
}
