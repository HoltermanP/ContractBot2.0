/**
 * Realistische demotekst per Baas-demo-document (doc_001 … doc_051).
 * Alleen gebruikt door scripts/seed-baas-demo.ts.
 */
import type { BaasDemoPdfSection } from './seed-contract-pdf'

export const BAAS_DEMO_DOC_BODIES: Record<string, BaasDemoPdfSection[]> = {
  doc_001: [
    {
      heading: 'Artikel 1 — Partijen en object',
      paragraphs: [
        'Tussen Stedin Netbeheer B.V., gevestigd te Rotterdam, hierna: “Opdrachtgever”, en Baas B.V., gevestigd te (fictief) Amersfoort, hierna: “Opdrachtnemer”, wordt de volgende raamovereenkomst gesloten voor de uitvoering van buurtgerichte netverzwaring en aanverwante civiele en elektrotechnische werkzaamheden in de in Bijlage A beschreven werkgebieden (Zuid-Holland, Utrecht en Zeeland).',
        'Deze overeenkomst heeft betrekking op programma’s waarbij vaste teams zijn gekoppeld aan de buurtaanpak-teams van Stedin, inclusief engineering, uitvoering, revisie en kort-cyclische opdrachten binnen de geldende UAV-GC 2005 en aanvullende Stedin-inkoopvoorwaarden.',
      ],
    },
    {
      heading: 'Artikel 2 — Looptijd en volumes',
      paragraphs: [
        'De overeenkomst loopt van de ingangsdatum tot en met 31 maart 2034, tenzij eerder beëindigd overeenkomstig artikel 9. De verwachte jaarlijkse omzet binnen deze raamovereenkomst is indicatief; er wordt geen minimumafname gegarandeerd. Opdrachten worden verstrekt via afzonderlijke opdrachtbevestigingen onder deze raam.',
      ],
    },
    {
      heading: 'Artikel 3 — Prijzen en indexatie',
      paragraphs: [
        'Prijzen worden vastgelegd conform het Prijzenboek (categorieën A–F) en de daarop van toepassing zijnde indexatie. Jaarlijkse prijsaanpassing vindt plaats per 1 januari op basis van CBS-producentenprizenindex reeks 412 “GWW”, tenzij partijen schriftelijk anders overeenkomen.',
      ],
    },
    {
      heading: 'Artikel 4 — Kwaliteit, veiligheid en omgeving',
      paragraphs: [
        'Opdrachtnemer handelt conform het V&G-plan van Stedin en bereikt binnen twaalf maanden na ondertekening ten minste trede 4 van de Safety Culture Ladder (SCL), tenzij een aantoonbare uitzondering door Opdrachtgever is aanvaard. Meldingen van verstorende werkzaamheden voor bewoners verlopen via het afgesproken lokale communicatieprotocol.',
      ],
    },
    {
      heading: 'Artikel 5 — Aansprakelijkheid',
      paragraphs: [
        'Behoudens opzet of grove schuld is de totale aansprakelijkheid van Opdrachtnemer per gebeurtenis beperkt tot 25% van de in het betreffende kalenderjaar onder deze raam gefactureerde omzet, met een maximum van 50% van die jaaromzet aan aansprakelijkheid in totaal per jaar.',
      ],
    },
    {
      heading: 'Artikel 6 — Opzegging',
      paragraphs: [
        'Opdrachtgever kan deze raamovereenkomst eenzijdig opzeggen met een opzegtermijn van twaalf (12) maanden. Op lopende opdrachten blijven de bepalingen van de betreffende opdrachtbevestiging van toepassing tot voltooiing of gezamenlijk overeengekomen beëindiging.',
      ],
    },
  ],

  doc_002: [
    {
      heading: '1. Dienstenniveau en bereikbaarheid',
      paragraphs: [
        'Opdrachtnemer stelt voor het vaste team een servicepunt beschikbaar op werkdagen tussen 07:00 en 19:00 uur. Storingen en onveilige situaties worden gemeld aan het Stedin storingsnummer; Opdrachtnemer bevestigt ontvangst binnen 30 minuten (P1) respectievelijk 2 uur (P2) na melding.',
      ],
    },
    {
      heading: '2. Beschikbaarheid team',
      paragraphs: [
        'Het toegewezen buurtteam moet ten minste 90% van de gecontracteerde productieve uren beschikbaar zijn voor geplande werkzaamheden in het betreffende werkgebied, gemeten per kwartaal. Gepland verlof en erkende feestdagen tellen niet mee in de noemer, mits tijdig afgestemd met de regio-planning van Stedin.',
      ],
    },
    {
      heading: '3. Responstijden (herstel)',
      paragraphs: [
        'Voor netcomponenten in de buurtaanpak geldt: P1 binnen 4 uur ter plaatse waar mogelijk; P2 binnen 24 uur; P3/P4 volgens het in de regio afgesproken planningsschema. Afwijkingen worden voorzien van een root-cause en herstelplan binnen vijf werkdagen.',
      ],
    },
    {
      heading: '4. Rapportage',
      paragraphs: [
        'Maandelijks wordt een SLA-rapportage verstrekt met beschikbaarheid team, P1–P4-tellingen, gemiddelde responstijden en geplande onderhoudsvensters. Stedin kan om een toelichting verzoeken binnen tien werkdagen na publicatie.',
      ],
    },
  ],

  doc_003: [
    {
      heading: 'Toepassingsgebied',
      paragraphs: [
        'Dit prijzenboek maakt integraal onderdeel uit van de raamovereenkomst STD-BUURT-2026-007. Alle bedragen zijn exclusief BTW, tenzij anders vermeld. Meerwerk wordt alleen uitgevoerd na schriftelijke opdracht conform de wijzigingsprocedure.',
      ],
    },
    {
      heading: 'Categorie A — Civiel LS-graven en herstel',
      paragraphs: [
        'Straatwerk zand/grond: € 85 per strekkende meter tot 1,2 m diepte inclusief bestrating herstel conform bestek.',
        'Verharding beton/tegels: € 125 per strekkende meter inclusief proefsleuven en foto-documentatie.',
        'Verkeersmaatregelen en bewonersbrief: forfait € 450 per werkplek per week (max. 4 weken).',
      ],
    },
    {
      heading: 'Categorie B — Kabel- en montagewerk LS',
      paragraphs: [
        'Koppelnet 4x150mm²: € 42 per strekkende meter inclusief trekken en aansluiten op bestaande velden.',
        'Ondergrondse lasplaatsen: € 2.850 per stuk inclusief materiaal en testrapport.',
      ],
    },
    {
      heading: 'Categorie C — MS-werkzaamheden (indicatief)',
      paragraphs: [
        'Montage MS-kabel conform tekening: op offerte na verificatie tracé en DSR-beschikbaarheid.',
        'Inbedrijfstelling en DMS-melding: € 1.950 per schakelhandeling (standaard scenario).',
      ],
    },
    {
      heading: 'Categorie D — Engineering en vergunningen',
      paragraphs: [
        'Werktekening pakket (standaard buurtsegment): € 3.200 per pakket, revisie € 95 per uur.',
        'Omgevingsvergunning/DSO-melding begeleiding: € 1.100 per traject (excl. leges).',
      ],
    },
    {
      heading: 'Categorie E — Revisie en datalevering',
      paragraphs: [
        'As-built levering NLCS/GIS binnen 10 werkdagen na oplevering: inbegrepen bij categorie A/B tenzij anders afgesproken.',
        'Late revisie (>10 wd): € 180 per uur met een minimum van € 900 per melding.',
      ],
    },
    {
      heading: 'Categorie F — Overige voorzieningen',
      paragraphs: [
        'Materieel stand-by (graafmachine + chauffeur): € 185 per uur, minimaal 4 uur per inzet.',
        'Weekend-/spoedtoeslag: 35% op uurtarieven categorie A/B bij aanvang tussen vrijdag 18:00 en maandag 06:00.',
      ],
    },
  ],

  doc_004: [
    {
      heading: '1. KPI-raamwerk',
      paragraphs: [
        'De prestaties van Opdrachtnemer worden per kwartaal beoordeeld op: (K1) tijdigheid oplevering geplande werkorders, (K2) herhalingsklachten omgeving, (K3) beschikbaarheid vast team conform SLA, (K4) kwaliteit revisiedata (first-time-right).',
      ],
    },
    {
      heading: '2. Targets en meting',
      paragraphs: [
        'K1: ≥ 92% van de werkorders binnen de geplande week afgerond. K2: ≤ 3 gegronde klachten per 100 strekkende meter in het kwartaal. K3: ≥ 90% teambeschikbaarheid. K4: ≤ 2% herstelrevisies op geleverde punten.',
        'Meetgegevens worden gebaseerd op Stedin-werkordersysteem, klachtenregister en het door Opdrachtnemer geleverde kwartaalrapport.',
      ],
    },
    {
      heading: '3. Bonus',
      paragraphs: [
        'Bij behalen van alle vier targets in een kwartaal: bonus 1,0% over de facturatie van dat kwartaal voor werkzaamheden onder deze raam. Bij drie van vier targets: bonus 0,5%.',
      ],
    },
    {
      heading: '4. Malus',
      paragraphs: [
        'Indien K3 < 90% beschikbaarheid vast team: malus 2% op de perioderekening van het betreffende kwartaal. Indien K1 < 85%: malus 1% extra. Malus bedragen worden verrekend op de eerstvolgende factuur na vaststelling.',
      ],
    },
  ],

  doc_010: [
    {
      heading: 'Artikel 1 — Samenwerkingsmodel',
      paragraphs: [
        'Deze raamovereenkomst regelt de gezamenlijke aanleg, vernieuwing en verzwaring van het elektriciteitsnet (Enexis Netbeheer B.V.) en het drinkwaterleidingnet (Brabant Water N.V.) in Noord-Brabant. Baas B.V. treedt op als uitvoerende partij in bouwteamfase en UAV-GC-fase, conform de in Bijlage 2 opgenomen rolverdeling met Hurkmans, BGM en APK/Rasenberg.',
      ],
    },
    {
      heading: 'Artikel 2 — Werkverdeling en planning',
      paragraphs: [
        'Gecombineerde graafsloten worden voor zover mogelijk synchroon gepland. De “leading” netbeheerder per perceel wordt vastgelegd in het werkverdelingsdocument; de andere partij sluit aan op de primaire planning tenzij veiligheid of continuïteit van levering anders vereist.',
      ],
    },
    {
      heading: 'Artikel 3 — Prijsbepaling en volume',
      paragraphs: [
        'Er is geen minimumafname gegarandeerd; opdrachten worden verstrekt op basis van programmacapaciteit en prestatie in voorgaande tranches. Meerwerk en risico’s uit simultane netdisciplines worden verdeeld volgens de split-clausule in artikel 11 van deze overeenkomst.',
      ],
    },
    {
      heading: 'Artikel 4 — Wijzigingen',
      paragraphs: [
        'Wijzigingen in scope, planning of interfaces lopen via de formele VTW-procedure; het voorstel dient binnen tien werkdagen te worden beoordeeld door het gezamenlijke bouwteamorgaan, waarna een besluit wordt vastgelegd in het wijzigingsregister.',
      ],
    },
  ],

  doc_011: [
    {
      heading: 'Fase 1 — Bouwteam',
      paragraphs: [
        'Partijen werken in bouwteamverband toe naar een integraal ontwerp en uitvoeringsstrategie voor gecombineerde energie- en waterinfra. Deelnemers aan het bouwteam: Enexis, Brabant Water, Baas B.V. en de in het teamregister opgenomen onderaannemers.',
      ],
    },
    {
      heading: 'Besluitvorming',
      paragraphs: [
        'Het bouwteamorgaan vergadert tweewekelijks. Besluiten over scope, budget en planning worden genomen bij unanimiteit van de kernpartijen (Enexis, Brabant Water, Baas). Bij stagnatie escaleert het dossier naar het programmabestuur binnen vijf werkdagen.',
      ],
    },
    {
      heading: 'Transitie UAV-GC',
      paragraphs: [
        'Na goedkeuring van het definitieve ontwerppakket en risicodossier vindt transitie plaats naar uitvoering onder UAV-GC 2005. De bouwteamovereenkomst blijft van toepassing op ontwerp- en engineeringverplichtingen; uitvoeringsjuridische relatie wordt per werkcluster vastgelegd in de aanbestedings- of gunningsstukken.',
      ],
    },
  ],

  doc_012: [
    {
      heading: '1. Elektra (Enexis)',
      paragraphs: [
        'Kabels conform NEN-EN-IEC 60502 en Enexis-materiaallijst ML-LS-2025. Diepte ligging: minimaal 0,9 m onder maaiveld tenzij anders vermeld op vergunningtekening. Waarschuwingstape en detectielint verplicht boven MS/LS conform Enexis-werkinstructie W-EL-014.',
      ],
    },
    {
      heading: '2. Drinkwater (Brabant Water)',
      paragraphs: [
        'PE-leidingen conform NEN-EN 12201 en Brabant Water technische richtlijn TR-DW-2019. Drukproef en bacteriologische bemonstering na aansluiting volgens protocol BW-PO-07. Afstand tot andere kabels/leidingen volgens coördinatieplan; bij twijfel geldt de strengste norm.',
      ],
    },
    {
      heading: '3. Gecombineerde sleuven',
      paragraphs: [
        'Sleufbreedte en onderlinge afstand worden per tracé vastgelegd in het coördinatieplan. Stabiliteit sleufwand: conform RAW §4.3 en lokale bodemrapportage. Trillingsmonitoring bij kwetsbare objecten binnen 10 m van de sleuf zoals aangegeven in het omgevingsdossier.',
      ],
    },
    {
      heading: '4. Documentatie',
      paragraphs: [
        'Revisie inclusief foto’s, testrapporten en GPS-metingen binnen tien werkdagen na werk gereed. Levering in NLCS 5.0 en shapefile conform de door beide netbeheerders aangeleverde templates.',
      ],
    },
  ],

  doc_020: [
    {
      heading: 'Artikel 1 — Voorwerp',
      paragraphs: [
        "Deze raamovereenkomst heeft betrekking op gecombineerde uitvoering van energie-, drinkwater- en telecomgerelateerde grond- en kabelwerkzaamheden voor de deelnemers aan GROND'G in Noord-Oost Nederland (Groningen, Drenthe, Overijssel), zoals nader gespecificeerd in de jaarprogramma’s en perceelbeschrijvingen.",
      ],
    },
    {
      heading: 'Artikel 2 — UAV-GC en RAW',
      paragraphs: [
        'Voor civiele werkzaamheden zijn de Standaard RAW Boringen 2015 van toepassing; voor totale aanneming van werken UAV-GC 2005. Bij tegenstrijdigheid tussen bijlagen wint de laatst gedateerde addendum, tenzij partijen anders vastleggen.',
      ],
    },
    {
      heading: 'Artikel 3 — Borging en retentie',
      paragraphs: [
        'Opdrachtnemer accepteert een retentie van 5% op periodieke facturen tot aan de eindoplevering van het betreffende werkcluster, vermeerderd met een onderhoudstermijn van twaalf maanden na oplevering. Vrijgave vindt plaats na akkoord op het revisiepakket en eventuele herstelpunten.',
      ],
    },
    {
      heading: 'Artikel 4 — Onderaanneming',
      paragraphs: [
        'Onderaanneming met een verwachte cumulatieve waarde boven € 500.000 per jaar vereist voorafgaande schriftelijke goedkeuring van de betrokken opdrachtgever(s) in het betreffende werkgebied.',
      ],
    },
    {
      heading: 'Artikel 5 — Data-eigendom',
      paragraphs: [
        'Alle revisie- en meetgegevens (NLCS, GIS, attributen) zijn eigendom van de respectieve opdrachtgevers. Baas B.V. verkrijgt een niet-exclusief gebruiksrecht voor uitvoering en interne kwaliteitsborging, tot maximaal vijf jaar na oplevering van het desbetreffende project, daarna vernietiging of overdracht conform archiefprotocol.',
      ],
    },
  ],

  doc_021: [
    {
      heading: '1. Toewijzing percelen',
      paragraphs: [
        "Werkpercelen worden toegewezen via het GROND'G portaal op basis van capaciteit, geografische nabijheid en gecertificeerde competenties. Een perceel omvat maximaal één primaire opdrachtgever-lead; andere netbeheerders koppelen als co-lead volgens het perceelkaartje.",
      ],
    },
    {
      heading: '2. Conflicten en overlapping',
      paragraphs: [
        'Bij overlapping van werkgebieden tussen Vitens, Waterbedrijf Groningen en Enexis geldt prioriteit voor storingsherstel en leveringszekerheid drinkwater. Escalatie naar regionaal overleg binnen 24 uur na vaststelling van het conflict.',
      ],
    },
    {
      heading: '3. Rapportage',
      paragraphs: [
        'Wekelijks overzicht van toegewezen en afgeronde percelen, inclusief afwijkingen >10% op doorlooptijd. Maandelijkse benchmark tussen uitvoerders op veiligheid (LTIF), kwaliteit revisie en klachten.',
      ],
    },
  ],

  doc_022: [
    {
      heading: 'Toepassing',
      paragraphs: [
        'Deze veiligheidsbijlage is van toepassing op alle werkzaamheden onder GRONDG-NO-2023-004. Opdrachtnemer certificeert zich binnen twaalf maanden na ondertekening van de hoofdovereenkomst op trede 4 van de Safety Culture Ladder (SCL), met erkenning door een geaccrediteerde auditor.',
      ],
    },
    {
      heading: 'Verplichtingen',
      paragraphs: [
        'Alle uitvoerend personeel volgt de V&G-leeftijd en toolboxmeetings conform het Baas V&G-jaarplan. Incidenten (inclusief bijna-ongevallen met potentieel ernstig letsel) worden binnen 4 uur gemeld aan het centrale meldpunt van de opdrachtgever-lead van het perceel.',
      ],
    },
    {
      heading: 'Audits en niet-naleving',
      paragraphs: [
        'Jaarlijkse SCL-audit door derde partij; bevindingen met prioriteit “hoog” worden binnen 30 dagen hersteld. Bij structurele niet-naleving kan de opdrachtgever opschorten tot herstel, zonder dat daardoor verplichtingen uit de overeenkomst ten aanzien van andere percelen vervallen.',
      ],
    },
  ],

  doc_030: [
    {
      heading: 'Artikel 1 — Kort-cyclische opdrachten',
      paragraphs: [
        'Structin verstrekt KCO’s voor gecombineerde aanleg van kabels en leidingen bij nieuwbouw in Zuid-Holland. Baas B.V. voert engineering (voor zover opgenomen), civiel, leggen en aansluiten uit conform RAW-bestek en KCO-specificaties in Bijlage B.',
      ],
    },
    {
      heading: 'Artikel 2 — Capaciteit',
      paragraphs: [
        'Gemiddeld worden circa 75 vakmensen ingezet op Structin-werkzaamheden. Opdrachtnemer waarborgt voldoende back-up bij piekbelasting en vervanging bij ziekte, in overleg met de regioplanning van Structin.',
      ],
    },
    {
      heading: 'Artikel 3 — Digitale keten',
      paragraphs: [
        'Opdrachtverstrekking verloopt via DSP; revisie en kwaliteitsborging via GO MapForms. Technische koppeling en authenticatie zijn verplicht; uitval van systemen wordt gemeld volgens de storingen-paragraaf in de DSP-addendum.',
      ],
    },
    {
      heading: 'Artikel 4 — Looptijd en verlenging',
      paragraphs: [
        'De overeenkomst eindigt op 31 december 2027. Partijen kunnen de overeenkomst stilzwijzend verlengen met telkens één jaar, tenzij een van partijen uiterlijk zes maanden voor afloop schriftelijk opzegt.',
      ],
    },
  ],

  doc_031: [
    {
      heading: '1. Werkomschrijving KCO',
      paragraphs: [
        'Aanleg van nuts-voorzieningstrajecten t.b.v. woningbouwlocaties: graafwerk, zandbed, leggen LS-kabels, drinkwater PE, glasvezelbuis en gas PE (indien van toepassing), inclusief herstel bestrating en groenvoorziening conform bestektekening.',
      ],
    },
    {
      heading: '2. Kwaliteitseisen',
      paragraphs: [
        'Proefsleuven en bodemclassificatie volgens RAW. Drukproef drinkwater en megger-test LS vóór afsluiting sleuf. Foto- en videodocumentatie op kritieke aansluitpunten.',
      ],
    },
    {
      heading: '3. Omgeving en communicatie',
      paragraphs: [
        'Bewonersinformatie minimaal 48 uur voor start, tenzij spoedherstel. Houding geluid en trillingen binnen de gemeentelijke normen; bij overschrijding direct maatregelen en melding aan gemeente en Structin.',
      ],
    },
    {
      heading: '4. Oplevering',
      paragraphs: [
        'Proces-verbaal van oplevering binnen 5 werkdagen na gereedmelding. Revisie binnen 24 uur na oplevering verplicht ingediend in DSP/GMF; na drie herinneringen volgt een kwartaal-maluspunt in het KPI-overleg.',
      ],
    },
  ],

  doc_032: [
    {
      heading: '1. Koppeling DSP',
      paragraphs: [
        'Baas B.V. gebruikt de Digitale SamenwerkingsPortaal (DSP)-omgeving van Structin voor orderacceptatie, planning en statusmutaties. Single sign-on verloopt via de door Structin verstrekte bedrijfsaccounts; persoonsgebonden accounts zijn niet overdraagbaar.',
      ],
    },
    {
      heading: '2. Beschikbaarheid en onderhoud',
      paragraphs: [
        'DSP heeft een doelbeschikbaarheid van 99,0% per kalenderjaar, exclusief gepland onderhoud (max. 8 uur per maand, aangekondigd ≥48 uur van tevoren). Bij langdurige uitval (>4 uur) schakelt Structin over op het calamiteitenprotocol met e-mailfallback.',
      ],
    },
    {
      heading: '3. Data en beveiliging',
      paragraphs: [
        'Order- en revisiedata blijven eigendom van Structin en de deelnemende netbeheerders. Baas verwerkt uitsluitend binnen de EU; subverwerkers worden vooraf gemeld. Logs van mutaties worden minimaal twee jaar bewaard.',
      ],
    },
  ],

  doc_040: [
    {
      heading: 'Artikel 1 — Meervoudige nutsinfra',
      paragraphs: [
        'Deze raamovereenkomst betreft gezamenlijke aanleg en vervanging van elektriciteitskabels (Stedin), drinkwater (Dunea en Oasen) en gasleidingen (Stedin) in de in het programmaplan genoemde gemeenten. Uitvoering geschiedt zodanig dat omgevingshinder en graafbewegingen worden geminimaliseerd.',
      ],
    },
    {
      heading: 'Artikel 2 — Kostenverdeling',
      paragraphs: [
        'Programmakosten worden verdeeld naar rato van asset-type: elektriciteit 45%, drinkwater 35%, gas 20%, tenzij een project-specifieke herijking door het MDSO-overleg wordt vastgesteld. Driejaarlijks herijking op basis van gerealiseerde volumes en storingsdata.',
      ],
    },
    {
      heading: 'Artikel 3 — Omgevings-KPI',
      paragraphs: [
        'Er geldt een maximum van drie gegronde klachten per 100 m open tracé per kwartaal. Overschrijding leidt tot malus van 0,5% op de betreffende factuurcyclus, cumulatief tot maximaal 2% per jaar, tenzij overschrijding het gevolg is van overmacht of gedwongen spoedwerk door derden.',
      ],
    },
  ],

  doc_041: [
    {
      heading: '1. Gecombineerd graven',
      paragraphs: [
        'Partijen plannen gezamenlijke sleuven volgens het maandschema van het MDSO-programmabureau. De “graafleider” wisselt per wijk; taken worden vooraf verdeeld in het digitale coördinatieboard. Gas-, water- en elektrawerk volgen de in het veld afgesproken volgorde tenzij veiligheid anders voorschrijft.',
      ],
    },
    {
      heading: '2. Verkeer en hinder',
      paragraphs: [
        'Verkeersmaatregelen worden geïntegreerd aangevraagd bij de gemeente. Nachtwerk alleen na schriftelijke instemming van bewonerscommissie en gemeente. Geluidsmetingen bij klachten binnen 48 uur.',
      ],
    },
    {
      heading: '3. Escalatie',
      paragraphs: [
        'Conflicten tussen nutsbedrijven worden opgelost op regioniveau binnen 2 werkdagen; daarna escalatie naar het MDSO-stuurgroepoverleg. Besluiten worden vastgelegd en gedeeld met uitvoerders binnen 24 uur.',
      ],
    },
  ],

  doc_050: [
    {
      heading: 'Artikel 1 — Voorwerp',
      paragraphs: [
        'Open Dutch Fiber en Baas B.V. sluiten dit projectcontract voor de realisatie van hoogbouwaansluitingen in Capelle aan den IJssel. Opdrachtnemer verzorgt civiel, binnenwerk, montage van glasvezel tot patchpaneel en overdracht aan bewoners conform de ODF-standaard “Highrise 2024”.',
      ],
    },
    {
      heading: 'Artikel 2 — Omvang',
      paragraphs: [
        'Het programma voorziet in aansluiting van maximaal 15.750 hoogbouw-woningeenheden, gefaseerd over de in Bijlage 1 opgenomen complexen. Exacte volumes per fase volgen uit door ODF vrijgegeven werkorders.',
      ],
    },
    {
      heading: 'Artikel 3 — Planning en bonus',
      paragraphs: [
        'Faseplanning met mijlpalen zoals vastgelegd in het projectplan. Bij oplevering van een fase meer dan twee maanden vóór de contractuele mijlpaaldatum wordt een bonus van 1,5% over de betreffende fase-facturatie toegekend, mits kwaliteitscontroles “first time right” zijn behaald.',
      ],
    },
    {
      heading: 'Artikel 4 — Toegang en VvE',
      paragraphs: [
        'Toegang tot gebouwen en technische ruimtes geschiedt via de door ODF aangewezen VvE-coördinator. Vertraging door bewoners of VvE-besluitvorming vormt geen grond voor verrekenbare vertraging voor Opdrachtnemer, tenzij Opdrachtnemer aantoonbaar nalatig is in het tijdig informeren van de VvE.',
      ],
    },
  ],

  doc_051: [
    {
      heading: '1. Bouwfysica en routes',
      paragraphs: [
        'Verticale hoofdleidingen worden aangebracht in de centrale technische schacht of conform statisch goedgekeurde alternatieve route. Brandwerende doorvoeren conform NEN 6068 en ODF-detail TSD-HR-09. Maximaal twee woningen per verticale aftakking tenzij anders berekend.',
      ],
    },
    {
      heading: '2. Binneninstallatie',
      paragraphs: [
        'Patchpaneel in meterkast of technische ruimte; minimale reserve 30% lege poorten. Kabeltype G657A2; buigradius conform fabrikant. OTDR-meting op elke verticale tak en documentatie in het ODF kwaliteitsportaal.',
      ],
    },
    {
      heading: '3. Civiel en entree',
      paragraphs: [
        'Binnenkomende buis tot pand: minimaal 2x 32 mm HDPE, aangesloten op hoofdtracé. Herstel gevel en entree conform architectuurtekening; kleur en materiaal door ODF goedgekeurd.',
      ],
    },
    {
      heading: '4. Test en overdracht',
      paragraphs: [
        'Doorlichting en acceptatie met bewoner of VvE-vertegenwoordiger; instructieblad en QR naar self-service. Servicegarantie eerste 90 dagen op montage en aansluiting, voor zover geen schade door derden.',
      ],
    },
  ],
}
