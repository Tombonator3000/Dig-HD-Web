# Figurregistrering, gjennomsiktige lag og puslespill

Toms tretten skjermbilder fra 16. oktober er feilreferanser. Godkjente hovedark fra 15. oktober er stilfasit. Grafikkfiler og skjermbilder ligger i `gpt-arbeid/rapporter/spillfeil-20261016`, aldri i kodegrenen.

## Motor

CDAT/BOMP registrerte tidligere et kostyme etter tegning. En glassmaske kunne da overta figurens pikselmerker uten informasjon om figuren under. Dekoderen registrerer nå faktisk skrevne piksler, kilderetning, transparens og om pikselen ble malt eller behandlet gjennom en skyggetabell. Z-maskering skjer før registreringen. Blast-objekter får egen registrering av den faktiske tabellvelgeren, også når oppslaget ikke endrer originalindeksen. Transparente piksler får ingen nye merker.

Under en myk HD-figur slettes originalens silhuett også når glass eller inventaret mørkner den. En normal, presist registrert bildepiksel blir ikke en effekt fordi rompaletten avviker fra eksportpaletten. Dette hindrer blant annet den orange originalmatten rundt kostyme 286 til 289 i å bli stående bak de frie HD-krystallformene.

Mørkning av tegnet HD bruker en fargetransform tilpasset den faktiske skyggetabellen og gjeldende palett. Den bruker ikke en ny faktor for hver piksel i det gamle bildet. Ellers ble originalens hånd- og ansiktstekstur synlig gjennom inventaret. Ekte nearest-bilder gjenkjennes ved innlasting og beholder eksakt originalbehandling. Klassisk visning er uendret. Den gamle begrensningen rundt svarte kildepiksler aktiveres bare ved faktisk palettmørkning og leser bildets egne naboer før overlegg, slik at den ikke lager nye firkantede mørke flekker.

Tilstanden leses ved vanlig spilling. Ingen spillregler, lagringer, tidsforløp eller skript er endret. Bare de eksplisitte testvalgene `DIGHD_TEST_DIRECTION` og `DIGHD_TEST_REMAP_PALETTE` endrer testaktørens retning/palett. Sistnevnte bruker spillets egen RGBS-remapping.

## Grafikkandidat

Tre nye hodeark bruker de godkjente hovedarkene for Boston, Maggie og Brink. De brukes til separate hoder og den eksplisitte gåfamilien i hovedkostymene. Hodene registreres sammen med kroppene etter AKCH/AKSQ, med fast kontakt ved halsen gjennom snakking. Utvalgte hodeløse kropper registreres ved halsen med føttene i ro. Syke Brink-varianter beholder grå hud.

Kostyme 59 får korrigert Boston-hode og halsfeste. Kostyme 60 får nye scene- og hoderuter: Maggie ved den døde Brink, med riktig blondt Brink-ansikt og de godkjente klærne. Den bevisst hodeløse ruten beholdes hodeløs, så den separate taleanimasjonen kan legges over. Indeksbilder og kildeanimasjoner er bevart.

Dette er en kandidat. Hovedarkgodkjenningen er ikke automatisk en ny godkjenning av alle animasjonsruter. En full gjennomspilling er ikke dekket av denne avgrensede kontrollen.

## Utvidet retting

Gjenoppstandelsen bruker kostyme 67, med egne hoder og kroppsdeler. Hoder og 40 kropper er erstattet med godkjent Brink-design, uten solbriller. Flere separate hoder i kostyme 73 er registrert fra samme ark. Boston ved vannet bruker kostyme 103. Dets RGBS-blokk er en hudrampe som ikke er den faktiske paletten i denne handlingen. Indeksbildene bruker nå originalens AKPL i rom 32 palett 0; selve indeksverdiene er uendret. 19 synlige kroppsruter er tegnet etter det godkjente Boston-arket.

225 sonderuter i kostyme 78 til 83 får den mørke kroppen tilbake, med originale mintpaneler, retninger og elektriske spor. 360 krystalltilstander registreres til originalens krystallomriss etter at bakgrunnsmatten er tatt ut. Konvekse kildehjørner klippes med antialias direkte i HD, slik at størrelsen følger originaltilstanden uten nye trappetrinn. Engraved rods i fire farger og rødt variantikon har kantete krystallfasetter og spiss ende, inkludert valgte/deaktiverte tilstander. Både myke `_hd.png`-filer og vanlige reservebilder er oppdatert.

52 skjelettdeler i kostyme 121 registreres til originalens silhuetter og lokale beinpalett. Bare bildefargen og registreringen endres. Originale aktørplasseringer, musefelt, rotasjoner og spillregler beholdes. Motorens fargetilpasning utelater nå faktiske palettmasker fra histogrammet. Tidligere ble magentafargen i den tekniske skyggemasken telt som beinfarge og ga grønnlig HD-skjelett.

Museum 119 bruker den eksisterende xBR-konturen også over selve kanten til forgrunnen. Tidligere ble alle skjulte originalpiksler hoppet over før utjevningen og ga 4×4 trinn på den skjulte siden. Den harde skjulingssiden beholdes bare for stavene som går ned i gulvet. Kontrollen ved tre kameraposisjoner viser kontinuerlig kant; kilde-zmasken og parallaxformelen er uendret. Dette tillater antialiasdekning over grensepiksler, og er ikke den tidligere r12-garantien om null dekning i hvert skjult originalpiksel.

## Automatisk registreringskontroll

`tools/check-character-registration.py --game /sti/game --mod /sti/mod --out /sti/privat-kontroll` leser AKCH/AKSQ fra private spillfiler og lager kontaktark og JSON uten å endre modden. Det setter sammen flerdelte AKSQ-kommandoer og kombinerer de separate stålagene. 627 utsnitt kontrollert; ingen ståhoder har mer enn ett originalpiksel glippe mot kroppens alfa. Utsnittene inkluderer også enkeltstående delgrupper som motoren bruker sammen med andre lag. Dette er ikke 627 komplett simulerte animasjoner. Identitet, tegnestil, spesielle poseringer og sammensetning over tid krever fortsatt visuell kontroll i motoren. Produksjonsscriptene i grafikkrapporten registrerer hoder mot godkjente ark og originale retninger, og bruker ett fast halsfeste per talefamilie.

## Kontroll

- Native motor kompilert. Hele patchrekken anvendt på den låste ScummVM-kilden; de berørte filene er byteidentiske med den kompilerte arbeidskilden.
- Pipeline: 50 bestått, 2 hoppet over, 2 spilltester ikke valgt.
- `engine/tests/test-hd-overlays.py`: nearest-inventar og nearest-krystaller er pikselidentiske med originalvisningen. Et konstant HD-bilde forblir konstant gjennom inventaret. Det siste tilfellet avdekker direkte om originalens tekstur blir preget inn i HD.
- Matrise med Boston, Maggie og Brink, åtte retninger hver, stå/gå/snakke, samt Brink-scenen, inventar, glass og krystaller: 77 tilfeller og 656 kontroller med null avvik ved full nytegning. 13 ekstra tilfeller dekker museum, sondevarianter, gjenoppstandelse, Boston ved vannet, skjelett og krystaller. Skjelettet er også kontrollert fra kopiert spillagring, siden et direkte introhopp ikke initialiserer originalens skyggetabell korrekt. Resultater og skjermbilder bevares i grafikkrapporten.
- `DIGHD_SKIP_VIDEO=1` gir et eksisterende avvik ved bilde 20 før testrommet. Samme avvik er kontrollert i den gamle motoren. Dette er registrert separat; romkontrollene begynner etter innlasting, fra bilde 100.
- Lokale skjermdumper bruker 16-bit SDL dummy. Windows, fysisk mobil, 32-bit OpenGL og full gjennomspilling er ikke kontrollert i denne runden.

## Reproduserbar regresjon

Krever Pillow, egne spillfiler, en mod og en kopi av en lagring i PDA-rom 79 med inventaret lukket:

```sh
python3 engine/tests/test-hd-overlays.py \
  --binary /sti/til/scummvm --game /sti/til/game --mod /sti/til/mod \
  --save /sti/til/kopi-av-pda-lagring --out /sti/til/privat-testmappe
```

Testen skriver avledede bilder bare til den oppgitte testmappen. Den berører ikke vanlige lagringer eller innstillinger.
