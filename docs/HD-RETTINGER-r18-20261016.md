# R18: figurregistrering og nye scenefunn

Tom bekreftet at skjermbildene er fra den publiserte AppImage-utgaven av r16. Ferdig r17-grafikk ligger allerede i PR64. R18 er en egen kandidat og er ikke en ny utgitt distro.

## Motor

Små hoder og større kroppsdeler fikk hver sin HD-skala fra avrundet, ferdigtegnet bredde/høyde. Ved aktørskala150/255 kan ett avrundet originalpiksel gi stor relativ forskjell på et lite hode. Patch0007 bruker aktørens faktiske X/Y-skala for alle delene. De siste originale dekoderskrivningene bestemmer hver dels kontinuerlige posisjon, også ved speiling og klipping. Originalens spillogikk og pikselskriving endres ikke. Uskalerte figurer og andre spill beholder tegnebanen sin.

`tools/check-character-registration.py` undersøker nå også talehoder fra lag1 sammen med kropp på samme handling/retning, med stålaget som reserve når et talehodelag bruker det. Dette er mulige kildekombinasjoner, ikke rekonstruert animasjonstiming. Kontrollrapporten måler både nærmeste avstand og bredden på kontakten. Figuridentitet, anatomi og riktig uttrykk krever fortsatt visuell vurdering.

## Grafikk

Grafikken ligger bare i gpt-arbeid og leveransegrenen. Rapport: `rapporter/spillfeil-r18-20261016` i gpt-arbeid.

- Hode/kropp: godkjente pilotavledede atlas, justert halskontakt, egne tale-/gestvarianter38/47/48/188 og korrigert ekstra manuell gråning av Brink16/17. R18 flytter ikke ansikt/hår i hovedkostymenes halsretting.
- Pole178: figur og lang stav registreres hver for seg, slik at stavens lengde ikke bestemmer figurens størrelse. Hele kildeserien er behandlet.
- Plateau55: to separate måneaktører148/149 med faktiske AKPL-/romfarger, mer malte fjell-/plantedetaljer, og åpning387/dirt388 tilpasset samme romtekstur. Effekt150 beholder motiv/timing og er mekanisk jevnet fra originalen.
- Tram-skjermbildet er rom80, identifisert med197 geometriske bildepunkt-treff. Gangflaten890 og de overlappende stasjonstilstandene554/983 bruker samme tegning. Originale blå tramflater beholdes.
- Nest44: silhuett av kjempeedderkopp136, ikke mus. Rist356/357 er tett av organisk bøss, og den opprinnelige åpne vann-tilstanden357_02 beholdes.
- Lightbridge-panel85: alle56 ruter i laserfamiliene233/234/235 er lyse stråler, ikke metallrør. Retninger og kontaktpunkter følger originalen.

Indeksverdier, objektrektangler, aktørposisjoner, manus og animasjonstiming beholdes. Der RGBS-råuttaket hadde feil visningsfarger, korrigeres PNG-paletten til faktisk rompalett, uten å endre indeksverdiene.

## Kontroll

- Motoren er kompilert lokalt. Hele patchstakken gjenskaper motorens kildefiler nøyaktig. Tre tester av stakket patchkontroll består, også i nettleserrepoet.
- Skalatest:18 kombinasjoner av Boston/Brink/Maggie, skala96/150/255 og retning2/6.36 native kjøringer mot ny og gammel motor. Originalens aktørpiksler er identiske; i full størrelse er HD-aktøren identisk.252 kontroller av delvis kontra full nytegning har null avvik. Tidsstyrte bakgrunnseffekter holdes utenfor sammenligningen av aktøren ved å bruke originale ruterektangler.
- Hele figurregresjonen er kjørt på nytt med r18:77 tilfeller og656 kontroller av delvis/full nytegning, null avvik.13 ekstra kontroller av museum, sondevarianter, Brink, Boston ved vann, skjelett og inventory/krystaller har330 nytegningskontroller uten avvik.
- Geometrisk kontroll:1511 sammensatte poseringer for17 relevante figurkostymer, inkludert tale- og handlingslag. Ingen flagget halsavstand eller for smal kontakt. Det er ikke en automatisk godkjenning av stil eller alle faktiske overganger.
- En første test traff en sporadisk avslutningsfeil i den gamle motoren etter ferdig frame220. Ny kontroll alene og de senere komplette sammenligningskjøringene avsluttet normalt. Testkjøringene bruker nå også separate XDG-mapper. Det påstås ikke at årsaken til den gamle avslutningsfeilen er funnet.
- Full gjennomspilling, alle overganger i normal spillrekkefølge, visuell godkjenning og prøving av en ny pakket AppImage gjenstår. Lokale kandidattester er ikke en pakketest.

## Avsluttende atlasopprydding

Ekstra native kontroll av38/47/48/188 (4000 oppdateringer hver,172 nytegningskontroller uten avvik) fant en løs hudfarget atlasrest over Maggies talehode.895 hoderuter er renset for små frakoblede alfakomponenter. Alle RGB-verdier og gjenværende alfapiksler er identiske; ansikt og hår flyttes ikke. Figurkontaktkontrollen er kjørt på nytt med1511 poseringer uten flagg. Full normal tram-innstigning er fortsatt ikke testet ferdig: knapp859 virket, men et tidlig innstigningsklikk traff ingen inngang mens trammen var underveis.

Hele figurregresjonen er også gjentatt etter atlasoppryddingen på den integrerte leveransemappen:77 tilfeller og656 nytegningskontroller, null avvik.
