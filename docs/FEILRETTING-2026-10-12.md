# Lagring, ikonkanter og animasjoner – 12. oktober 2026

F5 behandles som fysisk menytast før spillets skriptstyrte ASCII-bindinger.
En liten «Meny · F5»-knapp åpner samme meny. Menyen bruker fortsatt spillets
opprinnelige regler for når den kan åpnes. «Heap10000 Mem0 Vid0» er motorens
diagnostikkbanner; den nøyaktige utløseren i brukerens kjøring ble ikke gjenskapt.

HTTP-filsystemet slo tidligere opp én fil ved å bygge hele søskenlisten på nytt.
Det lekket dessuten indeksdata, katalogobjekter og nedlastingsobjekter. Backend
beholder nå én felles metadatatabell per kjøring og frigjør midlertidige data.
Dette fjerner kostnaden som økte med den store listen av HD-animasjonsruter.
Forespurte ruter starter først; opptil fire bakgrunnsarbeidere henter neste ruter.
Vinduet er begrenset til 48 filer / 8 MiB, med maksimalt 96 køoppføringer.

Små inventarikoner får fjernet bakgrunnsfarge langs den eksisterende harde
masken ved førstegangs lasting. Bare farger tett på en entydig skjult matte
endres, og bare der originalpaletten tilsier en annen farge. Alfa og bevisste
blå markeringer beholdes. Det vanlige blå markørkrysset beholdes også.

Fullskjerm kunne gi en GL-viewport på 2560 × 1440 mens tegnebufferen faktisk
var 2560 × 1219. WebGL-projeksjon og musekoordinater synkroniseres nå med den
faktiske canvas-bufferen. Rettelsen er avgrenset til Emscripten.
Motorens JS og Wasm lastes med versjon fra build.json ved hver start.

Verifisering:

- 19 JavaScript-tester: filer, privat dataruting, forhåndslasting og touch.
- 3 Python-tester: hele patchstakken og avvisning av manglende/ekstra endringer,
  med uendret arbeidskilde og Git-indeks.
- Faktisk HTTPFilesystemNode og JSON-parser kompilert til Wasm: 90 000 oppslag
  blant 30 000 filer, stabilt levende minne etter oppvarming, én indekslasting,
  eierskap til listede noder, filtrering, manglende/tomme kataloger og omdirigering.
- 149 private ikoner lastet gjennom C++-motoren: 6606 kantpiksler korrigert,
  ingen alfaendringer; resultatene stemmer med referanseimplementasjonen.
- Lokal Chrome-kjøring med originaldata: Save, omstart av siden, Load av lagringen.

En syntetisk nettverkstest med 20 ms responstid reduserte venting for tolv nye
animasjonsruter fra 711 til 254 ms. Dette er filventing, ikke målt spill-FPS.
Full gjennomspilling, mobil og brukerens konkrete lange spilløkt er ikke testet.
Ingen spillfiler eller HD-bilder inngår i den offentlige pakken.
