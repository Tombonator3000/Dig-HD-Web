# Motortester uten spillfiler

## Komprimert video

Kjør `engine/tests/test-hd-video.sh engine/scummvm` etter Linux-bygget, eller
med `engine/scummvm-web` etter nettleserbygget og aktivering av Emscripten.
Krever FFmpeg. Testen lager åtte syntetiske bilder og sammenligner den faktiske
VP8-dekoderen med FFmpeg i 16- og 32-bits RGB. Den prøver gjentatte, skippede
og baklengs rammer, omstart og skadde filhoder, pakker og tidsstempler.
Ingen avledede spillfiler sjekkes inn. Se `docs/HD-VIDEO.md`.

## Nettleserens filsystem og pakking

```sh
python3 engine/tests/test-build-pages.py -v
source engine/emsdk/emsdk_env.sh
engine/tests/test-http-fs-cache.sh engine/scummvm-web
```

Pakketesten bruker midlertidige Git-repoer og prøver stablede patcher,
manglende eller ekstra endringer og at kilder og indeks bevares.
Forventede Git-feil i de negative testene er normale; sluttresultatet skal være OK.

HTTP-testen bruker motorens faktiske filsystem og JSON-parser med en lokal
testbro for nettverkskall. Den prøver 90 000 oppslag i en mappe med 30 000 filer,
stabilt minnebruk etter oppvarming, mappeindekser, manglende filer, omdirigering,
normalisering og nytt forsøk etter feil. Den krever ingen nettleser eller nøkkel.
Lagring i IndexedDB, brukerinput og ytelse på mobil krever egen kontroll.
