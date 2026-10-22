export function render(el, brands, ctx) {
  const { model } = ctx;
  el.innerHTML = `<div class="methode">
  <h2>Méthode & sources</h2>
  <p>Le « Français lambda » est ici le Français moyen au sens statistique : il se loge, se chauffe, mange, s'habille, se soigne, travaille, se déplace, regarde la télévision, paie ses factures. Pour chaque poste de sa vie courante, on recense <b>largement</b> les acteurs qu'il a une chance réelle de croiser : les leaders et les acteurs significatifs du marché français, pas seulement le premier.</p>
  <h3>Ce qui est recensé</h3>
  <ul>
    <li><b>Contact direct</b> : les marques et enseignes qu'il voit et achète.</li>
    <li><b>Intermédiaires invisibles</b> : ceux qu'il paie sans le savoir (réseaux de paiement, gestionnaires de réseau d'électricité, fabricants de marques distributeur, centrales d'achat, restauration collective, logistique, éco-organismes…).</li>
    <li><b>Services publics et para-publics</b> : organismes sociaux, entreprises publiques, administrations.</li>
  </ul>
  <h3>Comment lire la propriété</h3>
  <p>Chaque marque est rattachée à l'entreprise qui l'exploite, puis on remonte la chaîne de contrôle (filiale → maison mère → holding) jusqu'au <b>contrôleur ultime</b> : une famille, un État, un fonds, des sociétaires, ou une société cotée sans actionnaire de contrôle. Les pourcentages sont ceux du capital lorsqu'ils sont publiés ; les droits de vote peuvent différer. Chaque pourcentage porte la date à laquelle il a été mesuré (rapport annuel, déclaration, opération) ; « date inconnue » signale un chiffre dont la source ne donne pas la date : à lire comme un ordre de grandeur.</p>
  <h3>Sources</h3>
  <p>Documents d'enregistrement universels et rapports annuels, sites des groupes, décisions de l'Autorité de la concurrence, observatoires de l'Arcep et de la CRE, panels Kantar et NielsenIQ cités par la presse, presse économique ; Wikipédia en dernier recours. Chaque fiche cite ses sources et sa date de vérification.</p>
  <h3>Limites</h3>
  <ul>
    <li>Une photographie : les actionnariats bougent (cessions, fusions). Dernière vérification : ${model.groupes.map((g) => g.verifie_le).filter(Boolean).sort().at(-1) || "—"}.</li>
    <li>Le nombre de marques mesure la <i>présence</i> d'un groupe, pas son chiffre d'affaires ni ce que dépense un ménage.</li>
    <li>L'exhaustivité est visée, pas garantie.</li>
  </ul>
  <h3>Corriger et tenir à jour</h3>
  <ul>
    <li>Chaque fiche porte un lien <b>Signaler une erreur</b>, qui ouvre un formulaire pré-rempli sur le <a href="https://github.com/s-geffroy/french-lambda/issues" target="_blank" rel="noopener">dépôt GitHub</a> (compte GitHub requis). Une marque manquante se signale de la même façon.</li>
    <li>Les fiches marquées <span class="tag doute">à confirmer</span> n'ont pas pu être établies par une source récente, ou décrivent une opération (rachat, OPA, cession) pas encore finalisée.</li>
    <li><b>Audit du 22 octobre 2026</b> : sur 30 fiches tirées au hasard et recontrôlées une à une contre des sources ouvertes, 14 étaient exactes, 10 comportaient une imprécision mineure (date, chiffre arrondi) et 6 une erreur notable, le plus souvent une répartition du capital périmée. Ces 30 fiches ont été corrigées ; les pourcentages des autres sont à lire comme des ordres de grandeur datés.</li>
    <li>Chaque trimestre, un relevé automatique liste les opérations à surveiller et les fiches les plus anciennes, dans une <i>issue</i> « Veille » du dépôt.</li>
  </ul>
  <h3>En chiffres</h3>
  <p>${model.brands.length} marques, ${model.groupes.length} entreprises et actionnaires, ${model.ref.categories.length} catégories regroupées en ${model.ref.macros.length} postes de vie.</p>
  </div>`;
}
