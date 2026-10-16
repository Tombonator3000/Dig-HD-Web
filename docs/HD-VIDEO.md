# Komprimert HD-video

Motoren kan lese `san/SQ1.ivf` fra HD-modden i stedet for 3772 PNG-filer.
Det er VP8-video i IVF-container, uten lyd. SAN-filen fra originalspillet
fortsetter å styre tidspunkt, lyd, undertekster og skripthendelser. Dette
gjelder også filmer spillet avbryter eller starter fra et senere rammenummer.

## Filformat og tilbakefall

- Navn: `san/<SAN-navn i store bokstaver>.ivf`, for eksempel `san/SQ1.ivf`.
- IVF versjon 0, 32-byte filhode, kodek `VP80`, YUV 4:2:0.
- Raster: nøyaktig spillflaten ganger HD-skalaen. The Dig i 4x er 1280 x 800.
- Én synlig videoramme per SAN-ramme, uten interpolering eller skjult alt-ref.
  Første IVF-tidsstempel er 0, så 1, 2 osv. PNG `00000.png` og IVF-ramme 0
  erstatter begge SmushPlayer-ramme 1. SAN er klokken; IVF-fps endrer ikke spillet.
- Original pikselgeometri beholdes. ScummVM sin sideforholdskorreksjon gir 4:3.
  Ikke strekk bildefilen til 1440 x 1080 før innlegging i modden.
- Video velges først. Manglende, ugyldig eller avkortet video gir PNG-tilbakefall
  (`san/SQ1/00000.png` osv.), ellers originalgrafikk. Feil logges én gang per film.
  En motor uten libvpx støtter fortsatt PNG og originalgrafikk.

Dekoderen beholder én RGB-flate og én komprimert pakke, i tillegg til libvpx sine
referansebilder og motorens skjermflater. Den laster ikke alle dekodede bilder
i minnet. Nettleserens eksisterende HTTP-lagring henter selve IVF-filen samlet.
Pakker er begrenset til 16 MiB; filhode, dimensjoner, nøkkelbilder og tidsstempler
kontrolleres. Gjentatte skjermkopier bruker samme bilde, hopp frem dekoder mellomrammene,
og hopp tilbake starter dekoderen på nytt. Tilstanden frigis ved avslutning og
ved hver ny SAN-avspilling, også av samme fil. Klassisk modus følger dekodingen,
slik at bytte tilbake til HD skjer på riktig bilde.

## Introen SQ1

Filmen ligger i datagrenen `hd-mod`, via en egen PR. Ingen spillbilder eller
videoer ligger i `main`. Alle tidligere publiserte grafikkfiler bevares.

| Egenskap | Verdi |
| --- | --- |
| Bilder / varighet | 3772 / 314,333 sekunder, 12 fps |
| Metode | AnimeSR v2, 4x, kjørt per klipp med åtte oppvarmingsrammer |
| PNG-master | 4 269 572 438 byte |
| `san/SQ1.ivf` | 22 775 540 byte, 99,467 prosent mindre |
| SHA-256 | `31a5f3c99af6d836d2be7837f06528e1c4d1931685c9050d057cdd9278441906` |
| SSIM mot master, alle bilder | 0,989466, målt med FFmpeg i YUV 4:2:0 |

Kompresjonen er tapsbasert. Produksjonsdata og sjekksummer ligger i moddens
`san/SQ1.json` og `SHA256SUMS`. Original `VIDEO/SQ1.SAN` og musikk-/talebuntene
må fortsatt være tilgjengelige. IVF har bare bildet.

En ny film kan kodes slik fra en nummerert PNG-sekvens (sett riktig fps):

```sh
ffmpeg -framerate 12 -start_number 0 -i '%05d.png' \
  -c:v libvpx -crf 10 -b:v 1M -deadline good -cpu-used 2 -g 120 \
  -auto-alt-ref 0 -lag-in-frames 0 -pix_fmt yuv420p -an -f ivf SQ1.ivf
```

Kontroller rammeantall, tidsstempler og dekoding før innlegging. H.264, HEVC og
AV1 i MP4 støttes ikke av denne løsningen. VP8 bruker libvpx som allerede finnes
i den låste ScummVM-kilden og kan bygges for både Linux og WebAssembly.

## Bygging og kontroll

Linux: installer `libvpx-dev libvorbis-dev libogg-dev` sammen med de øvrige
byggeavhengighetene. ScummVM sin eksisterende MKV-dekoder under `USE_VPX`
krever også Vorbis. `engine/build.sh` konfigurerer på nytt når patchen endres.

Nettleser: `engine/build-web.sh` bygger libvpx 1.15.0 fra kilde med kontrollert
SHA-256, uten kodere eller tråder, og aktiverer Vorbis/Ogg-portene i Emscripten.
Kildeoppskrift og den nye dekoderen følger med GPL-arkivet; libvpx-lisensen
følger med motorpakken. Nettleserens lokale og eksterne filindekser tar med IVF.
De eksisterende rettingene for HTTP-metadata og lerretskoordinater fra Dig-HD-Web
er også synkronisert tilbake, sammen med kontrollen av hele patchstabelen.

```sh
engine/build.sh
engine/tests/test-hd-video.sh engine/scummvm
node --test engine/pages/tests/*.test.mjs
python3 engine/tests/test-build-pages.py -v
engine/build-web.sh
source engine/emsdk/emsdk_env.sh
engine/tests/test-hd-video.sh engine/scummvm-web
engine/tests/test-http-fs-cache.sh engine/scummvm-web
```

Kontroll 16. oktober 2026: Linux-bygget og dekodertesten består. Hele SQ1 er kjørt
uten skjerm til rom 2, med 3772 dekodede bilder og 0 avvik mellom skjermen og
en full nybygging i alle 32 dumper. Undertekster ligger over HD-bildet. Ctrl+H
til/fra klassisk, Ctrl+Shift+H og Escape er prøvd. En ugyldig IVF ga først
PNG-bilder med 0 pikselavvik mot nearest-originalen, deretter originalbilde når
PNG manglet. Dekodertesten sammenligner mot FFmpeg i 16- og 32-bits RGB, prøver
gjentatte/skippede/baklengs rammer og avviser skadde filhoder, pakker og tidsstempler.
Nettleserbygget og samme dekodertest i WebAssembly består, sammen med HTTP-testen.
Chromium har kjørt 650 skjermoppdateringer av introen, med komprimert video,
undertekster og bytte til/fra klassisk grafikk, uten videofeil.
Windows og mobil er ikke testet. Full visuell godkjenning i bevegelse gjenstår.
