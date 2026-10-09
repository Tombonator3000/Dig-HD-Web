# The Dig HD på GitHub Pages

Nettsiden inneholder bare den kompilerte ScummVM-motoren med DigHD-patchen,
brukergrensesnittet, ScummVM sine temaer og tilhørende kildekode. Spillfiler,
HD-bilder, referanser og konseptbilder skal aldri inn i nettsidepakken.

Dette er en egen nettleserinngang. `./spill.sh --nettleser` beholder den gamle
localhost-løsningen med private filer fra maskinen.

## Spille

Siden går rett inn i spillet, som originalen: introen, så spillet. Det er ingen
knapper eller menyer rundt spillet. Grafikkvalget ligger i spillets egen meny.

Første gang ber siden om én ting: en lesenøkkel til det private repoet
Tombonator3000/Dig-HD-Remake, der spillet (grenen `spilldata`) og HD-pakken
(grenen `hd-mod`) ligger. Lag nøkkelen på
https://github.com/settings/personal-access-tokens/new:

- Repository access: Only select repositories, Dig-HD-Remake
- Permissions: Contents, Read-only
- Utløpsdato etter eget valg

Lim den inn og trykk **Spill**. Nøkkelen lagres bare i denne nettleseren
(IndexedDB). Etterpå går siden rett inn i spillet hver gang.

Filene hentes fra GitHub når spillet trenger dem, med nøkkelen, og lagres i
nettleseren etter git-blob-ID. Første start henter DIG.LA0, DIG.LA1 (88 MB) og
introfilmen; siden viser hvor langt den har kommet for store filer. Rom, figurer
og filmer hentes når spillet kommer til dem. Ved hver start hentes fillisten for
de to grenene på nytt (to små forespørsler), så ny HD-grafikk i `hd-mod` kommer
med av seg selv, og bare filene som er endret, hentes. Filer som den gamle
HD-pakken hadde og den nye ikke har, slettes fra nettleseren etter 30 sekunder.
Uten nett brukes fillisten og filene fra forrige gang.

Ingen spillfil eller HD-fil ligger på nettsiden eller sendes dit. Forespørslene
går bare til api.github.com for det private repoet. Nettsiden er offentlig, men
uten nøkkel med tilgang til repoet kommer ingen videre enn til nøkkelfeltet.
Alle Pages-sider under tombonator3000.github.io deler opprinnelse og dermed
nettleserlagring, så nøkkelen skal bare ha lesetilgang til dette ene repoet.

Første start henter talen (130 MB), musikken (261 MB), spillet (88 MB) og
introfilmen (50 MB) før spillet kan vise noe, fordi ScummVM åpner lydfilene når
motoren starter. Siden viser da et svart bilde med hva som lastes ned og hvor
langt det har kommet (for eksempel "Laster ned musikken: 120 av 261 MB").
Senere starter spillet med en gang.

Fullskjerm: nettlesere tillater fullskjerm bare etter et klikk eller en tast,
så spillet går over i fullskjerm ved det første klikket eller tastetrykket.
I Chrome og Edge låses Esc (Keyboard Lock), så Esc fortsatt hopper over en
scene; hold Esc for å gå ut av fullskjerm. Firefox går ut av fullskjerm på Esc,
og neste klikk eller tast gir fullskjerm igjen.

Tegning: spillet tegnes med WebGL. Har nettleseren ikke WebGL (slått av, eller
grafikkortet er sperret), bruker siden ScummVMs programvaretegning
(`--gfx-mode=surfacesdl`), og `?programvare` velger den med vilje. Kan
nettleseren ikke tegne spillet i det hele tatt, sier siden det i stedet for å
bli stående på "Starter The Dig".

Grafikk: F5 åpner spillets meny. Der står **HD Graphics** med en
avkrysningsboks under Text Speed: kryss gir HD, tom boks gir originalgrafikken.
Valget lagres og gjelder neste gang. Ctrl+H bytter også.

Mobil og nettbrett (`engine/pages/touch.mjs`). Siden tar seg av all berøring på
spillet selv og gir ScummVM museklikk og taster, så ScummVM sin egen
berøringsstyring ikke er med:

- trykk: klikk der fingeren var
- dra: flytter pekeren (det den peker på, lyser opp); å løfte fingeren klikker ikke
- hold fingeren i ro et halvt sekund: høyreklikk
- to fingre: spillets meny (F5)
- tre fingre: hopp over en filmscene (Esc)

Første trykk gir fullskjerm. Skjermen snus ikke; spillet følger hvordan
telefonen holdes.

Mistes kontakten med GitHub mens spillet trenger en fil, venter spillet og
siden prøver igjen (etter 1, 2, 4, 8 og så hvert 15. sekund) til filen er
kommet. Det samme gjelder svar 5xx, 429 og grensen for antall forespørsler. En
fil som kommer ufullstendig, hentes på nytt. Bare en nøkkel GitHub avviser,
stopper.

Andre valg i adressen:

- `?uten-lyd` starter uten musikk og tale (se under)
- `?programvare` tegner uten WebGL
- `?ny-nokkel` ber om en ny nøkkel (for eksempel når den gamle er utløpt; en
  nøkkel GitHub avviser, gir også nøkkelfeltet igjen)
- `?rom=22` hopper til stranden for testing, `?klassisk` og `?gult` som ellers
- testkrokene fra motoren, for eksempel `?rom=22&DIGHD_TEST_COSTUME=14`, som
  setter Boston Low inn på stranden og viser alle animasjonene hans

Uten nøkkel kan spillet også kjøre fra mapper på maskinen: **Bruk heller mapper
på denne maskinen** under nøkkelfeltet, så spillmappen (DIG.LA0, DIG.LA1, VIDEO)
og HD-mappen (mod.json, rooms, vanligvis `mods/gpt`). Filene kopieres til
nettleseren, og siden går rett inn i spillet etterpå. En nyere HD-pakke må da
velges på nytt (`?ny-nokkel` viser feltet og lenken igjen).

HD-pakken bruker 4x grafikk og jevn HD-tekst. Rom, objekter og figurruter med
HD-bilde vises i HD. Det som ennå ikke finnes i pakken (de fleste figurrutene og
alle filmene), vises som originalen forstørret fire ganger.

Musikk og tale: DIGMUSIC.BUN (261 MB) og DIGVOICE.BUN (130 MB) ligger i grenen
`spilldata` i deler på 90 MB (`DIGMUSIC.BUN.001` til `.003`, `DIGVOICE.BUN.001`
og `.002`), fordi GitHub ikke tar filer over 100 MB. Siden setter delene sammen
i nettleseren. De hentes første gang spillet spiller musikk, altså like etter
introen, og ligger i minnet så lenge spillet går (ScummVMs nettleserversjon
leser hele filer). Målt i Chromium: omtrent 0,9 GB JavaScript-minne og 0,37 GB
WebAssembly-minne med lyd. Derfor er lyden med bare når nettleseren melder
minst 4 GB minne (`navigator.deviceMemory`), og `?uten-lyd` slår den av. Lagrede spill og scummvm.ini ligger i nettleserens lagring
(IDBFS) og blir der selv om spillfilene slettes. Nettlesere kan slette lokal
lagring ved lite ledig plass, og privatmodus kan gjøre lagringen midlertidig.

Når spillet avsluttes fra menyen (Quit), viser siden **Spill igjen**.

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
