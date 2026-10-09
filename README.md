# The Dig HD Web

Nettlesermotor for The Dig med DigHD-støtte, på GitHub Pages:

**https://tombonator3000.github.io/Dig-HD-Web/**

Siden går rett inn i spillet. Første gang ber den om en lesenøkkel til eierens private repo, der spillet og HD-pakken ligger; filene hentes derfra ved behov og lagres i nettleseren. Mapper på maskinen virker også. Ingen spillfiler eller HD-bilder ligger på nettsiden eller sendes hit. HD eller originalgrafikk velges i spillets egen meny (F5, HD Graphics).

Motoren bruker ScummVM med DigHD-patchen, med 4x HD-grafikk der pakken har slike bilder, og jevn HD-tekst. Originale spillregler og skript er bevart. Grafikk som mangler i pakken, vises oppskalert fra originalen.

## Bygge og publisere

Se [byggeoppskriften](docs/PAGES.md). GitHub Actions bygger den låste ScummVM-versjonen, kjører filtestene og publiserer bare motorpakken til Pages. Spillfiler og HD-grafikk skal aldri legges i dette repoet.

ScummVM og patchen er GPL-3.0-or-later. Nettsiden har et nedlastbart kildearkiv med den faktiske motoren, patchen, nettlesergrensesnittet og byggeoppskriften. The Dig tilhører Lucasfilm/Disney. Dette er et uoffisielt prosjekt.
