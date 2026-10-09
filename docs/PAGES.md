# The Dig HD på GitHub Pages

Nettsiden inneholder bare den kompilerte ScummVM-motoren med DigHD-patchen,
brukergrensesnittet, ScummVM sine temaer og tilhørende kildekode. Spillfiler,
HD-bilder, referanser og konseptbilder skal aldri inn i nettsidepakken.

Dette er en egen nettleserinngang. `./spill.sh --nettleser` beholder den gamle
localhost-løsningen med private filer fra maskinen.

## Spille

1. Åpne nettsiden i en oppdatert Chrome, Edge eller Firefox.
2. Velg spillmappen med DIG.LA0, DIG.LA1 og VIDEO.
3. Velg HD-mappen med mod.json og rooms, vanligvis mods/gpt.
4. Trykk **Spill med HD**.

Filene lagres i IndexedDB på brukerens maskin. Ingen spillfil eller HD-fil
sendes til GitHub. Etter omlasting er filene klare uten nytt mappevalg.
Lagring i ScummVM er separat og beholdes hvis man fjerner den lokale filpakken.
Nettlesere kan slette lokal lagring ved lite ledig plass; da må mappene velges
på nytt. Privatmodus kan gjøre lagringen midlertidig.

Ctrl+H bytter HD og klassisk, F5 åpner spillmenyen. Knappene øverst gjør det
samme. Fullskjerm åpnes med knappen. `?rom=22` hopper til stranden for testing.
`?klassisk=1` og `?gult=1` er også støttet.

HD-pakken bruker 4x grafikk og jevn HD-tekst. Rom, objekter og figurruter som
har HD-bilder i pakken, vises i HD. Det som ennå ikke finnes i pakken (de fleste
figurrutene og alle filmene), vises som originalen forstørret fire ganger.
Etter at HD-mappen er valgt, viser siden hvor mange HD-rom, objektbilder og
figurruter pakken har, og når den ble laget. Nettleseren bruker kopien den
lagret sist, så en nyere HD-pakke må velges på nytt. DIGMUSIC.BUN og
DIGVOICE.BUN i spillmappen gir musikk og tale. Nettleseren viser om de mangler.

Testkrokene fra motoren kan settes i adressen. `?rom=22&DIGHD_TEST_COSTUME=14`
setter Boston Low inn på stranden og viser alle animasjonene hans etter
hverandre.

## Bygge fra kildekode

Krever git, make, Python 3, pkg-config, tar, xz og zip. Kjør fra prosjektroten:

```sh
JOBS=2 engine/build-web.sh
python3 engine/build-pages.py
```

ScummVM er låst til engine/SCUMMVM_COMMIT. Emscripten 4.0.10 med Node,
Clang og SDL3/libpng/zlib-portene hentes til engine/emsdk. Byggeskriptet bruker
ScummVM sin konfigurasjon, bare SCUMM v7/v8 er med, og prosjektets HD-patch
legges på. Ingen av disse stegene henter spillet eller HD-pakken.

Nettsiden havner i out/pages. `source.tar.gz` inneholder den faktiske patchte
ScummVM-kilden, HD-patchen, nettleserkoden og byggeoppskriften. I kildearkivet
kan `engine/build-web.sh` bygge fra den låste oppstrømscommiten igjen.
Motoren og HD-patchen er GPL-3.0-or-later; ScummVM sin COPYRIGHT og de
medfølgende lisensfilene skal følge nettsiden.

## Publisere

Publiser bare innholdet i out/pages. Bruk et eget repo uten private spillgrener
hvis GitHub-abonnementet ikke støtter Pages fra det private spillrepoet.
Spillrepoets synlighet skal ikke endres.

En arbeidsflyt som bruker actions/upload-pages-artifact og actions/deploy-pages
kan publisere pakken. Alternativt kan Pages servere roten i en egen gh-pages-
gren. Nettsiden bruker relative adresser til motoren, så prosjektprefikset på
GitHub Pages virker. Motorens virtuelle /data-adresser besvares lokalt eller
oversettes til prosjektets adresse for ScummVM-temaene.

Filpakkeren bruker en navneliste for ScummVM-temaene og kopierer aldri
data/games fra distribusjonen. Kontroller build.json og filene før publisering.

## Verifisering

```sh
node --test engine/pages/tests/*.test.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory out
```

Åpne http://127.0.0.1:8000/pages/ for å teste prosjektprefikset. Kontroller
mappevalg, HD, omlasting, HD-bryter og lagring med de private lokale filene.
Spillfiler og HD-bilder skal ikke være tilgjengelige som HTTP-ressurser.
En full gjennomspilling og mobiltest må rapporteres separat.
