// Service worker : le jeu se joue sans réseau, et prend toujours la dernière version quand il y en a.
// - à l'installation, tout le jeu est mis en cache (la version et la liste des fichiers sont écrites par outils/construire.mjs :
//   la version est l'empreinte sha256 de tous les fichiers — un seul octet change, la version change) ;
// - ensuite, le réseau d'abord : chaque fichier est redemandé (vérification rapide, le serveur répond « inchangé » si rien n'a
//   bougé) et le cache est rafraîchi ; sans réseau, ou s'il tarde plus de 3 s, le cache répond ;
// - un fichier SANS copie en cache (un fichier nouveau, juste après une mise à jour) attend le réseau au lieu d'abandonner au
//   bout de 3 s (LS, 02/10 : sur un téléphone, une image du décor manquait, et l'écran se couvrait de traînées).
const VERSION = "f7d20a2c2449";
const FICHIERS = ["./","index.html","jeu.js","styles.css","images/champ/banniere.png","images/champ/bouclier.png","images/champ/casque.png","images/champ/corbeau.png","images/champ/corniche-droite.png","images/champ/corniche-gauche.png","images/champ/corniche-milieu.png","images/champ/debris.png","images/champ/eclat.png","images/champ/enfouis.png","images/champ/fond.png","images/champ/ilot-fragile.png","images/champ/ilot-roche.png","images/champ/ilot.png","images/champ/lances.png","images/champ/pieu.png","images/champ/plastron.png","images/champ/sortie.png","images/champ/ui-eclat-plein.png","images/champ/ui-eclat-vide.png","images/champ/ui-essais.png","images/champ/ui-jauge-annonce.png","images/champ/ui-jauge-secousse.png","images/champ/ui-remplissage.png","images/decor/fond-champ.png","images/demo/errant.png","images/gorm/calme.png","images/gorm/excite.png","images/gorm/jette.png","images/gorm/pousse-bas.png","images/gorm/pousse-haut.png","images/gorm/pousse.png","images/gorm/rappelle.png","images/gorm/tire-bas.png","images/gorm/tire-haut.png","images/gorm/tire.png","images/nib/arret.png","images/nib/atterrissage.png","images/nib/decollage.png","images/nib/demi-tour.png","images/nib/halte.png","images/nib/hesitation.png","images/nib/marche-omni-repeinte.png","images/nib/marche-omni.png","images/nib/marche.png","images/nib/secousse.png","images/nib/trebuchement.png","images/nib/vol.png","icones/icone-180.png","icones/icone-192.png","icones/icone-512.png","icones/icone-masquable-512.png","manifest.webmanifest"];
const PREFIXE = 'porte-moi-';
const CACHE = PREFIXE + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((c) => c.startsWith(PREFIXE) && c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(servir(r));
});

const trop = (ms) => new Promise((_, non) => setTimeout(() => non(new Error('réseau trop lent')), ms));
async function servir(r) {
  const c = await caches.open(CACHE), copie = await c.match(r.url, { ignoreSearch: true });
  try {
    const demande = fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' });
    const reponse = await (copie ? Promise.race([demande, trop(3000)]) : demande);
    if (reponse.ok) { c.put(r.url, reponse.clone()); return reponse; }
  } catch {}
  // hors ligne : le cache ; une ouverture de page (même avec #… dans l'adresse) reçoit la page du jeu
  return copie
    || (r.mode === 'navigate' && await c.match('index.html'))
    || Response.error();
}
