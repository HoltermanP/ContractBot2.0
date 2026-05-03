/**
 * Demodata: Baas B.V. (ondergrondse infra) — gemapt op Drizzle-schema.
 * Voegt organisatie, leveranciers (opdrachtgevers), projecten, contracten,
 * documenten en verplichtingen (clausules + mijlpalen) toe.
 *
 * Gebruik: npm run db:seed:baas
 *
 * Idempotent per contractnummer / projectcode (geen volledige DB-wipe).
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

/** Strip omringende quotes (soms in .env gezet) zodat Neon de URL accepteert. */
function normalizeDatabaseUrl(raw: string | undefined): string {
  if (!raw) return ''
  const t = raw.trim()
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t
}

function logDbTarget(url: string) {
  try {
    const u = new URL(url)
    console.log(`📡 Neon/host: ${u.hostname}${u.pathname}\n`)
  } catch {
    /* ignore */
  }
}

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
if (!DATABASE_URL) {
  console.error('DATABASE_URL ontbreekt. Zet deze in .env.local (Neon connection string).')
  process.exit(1)
}
logDbTarget(DATABASE_URL)

const sql = neon(DATABASE_URL)
const db = drizzle(sql, { schema })

const DEMO_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
const ORG_SLUG = 'baas-bv-demo'

/** Opdrachtgevers / samenwerkingspartijen (excl. Baas = tenant). */
const COUNTERPARTIES: Array<{
  demoId: string
  name: string
  kvk: string
  segment: string
  type: string
}> = [
  { demoId: 'org_liander', name: 'Liander N.V.', kvk: '09104351', segment: 'energy', type: 'dso_electricity' },
  { demoId: 'org_stedin', name: 'Stedin Netbeheer B.V.', kvk: '24306393', segment: 'energy', type: 'dso_electricity' },
  { demoId: 'org_enexis', name: 'Enexis Netbeheer B.V.', kvk: '17270975', segment: 'energy', type: 'dso_electricity' },
  { demoId: 'org_vitens', name: 'Vitens N.V.', kvk: '05064879', segment: 'water', type: 'dso_water' },
  { demoId: 'org_dunea', name: 'Dunea N.V.', kvk: '27188939', segment: 'water', type: 'dso_water' },
  { demoId: 'org_oasen', name: 'Oasen N.V.', kvk: '29013632', segment: 'water', type: 'dso_water' },
  { demoId: 'org_evides', name: 'Evides Waterbedrijf', kvk: '24339519', segment: 'water', type: 'dso_water' },
  { demoId: 'org_brabantw', name: 'Brabant Water N.V.', kvk: '18014847', segment: 'water', type: 'dso_water' },
  { demoId: 'org_wbg', name: 'Waterbedrijf Groningen', kvk: '02038411', segment: 'water', type: 'dso_water' },
  { demoId: 'org_grondg', name: "Stichting GROND'G", kvk: '76234512', segment: 'multi', type: 'collaboration' },
  { demoId: 'org_structin', name: 'Structin (samenwerking ZH)', kvk: '27172984', segment: 'multi', type: 'collaboration' },
  { demoId: 'org_mdso', name: 'MDSO (Stedin/Dunea/Oasen)', kvk: '00000001', segment: 'multi', type: 'collaboration' },
  { demoId: 'org_odf', name: 'Open Dutch Fiber', kvk: '76210245', segment: 'telecom', type: 'telecom' },
  { demoId: 'org_delta', name: 'DELTA Netwerk', kvk: '20167190', segment: 'telecom', type: 'telecom' },
  { demoId: 'org_groningh', name: 'Stichting Groninger Huis', kvk: '02085923', segment: 'housing', type: 'housing' },
  { demoId: 'org_gemzaan', name: 'Gemeente Zaanstad', kvk: '01205028', segment: 'public', type: 'government' },
]

type DemoContractRow = {
  demoId: string
  contractNumber: string
  title: string
  principalDemoId: string
  contractTypeSql: 'framework_agreement' | 'project_contract'
  valueEur: string
  startDate: string
  endDate: string
  statusSql: 'active'
  contractForm: string
  scopeSummary: string
}

const DEMO_CONTRACTS: DemoContractRow[] = [
  {
    demoId: 'ct_stedin_buurt_2026',
    contractNumber: 'STD-BUURT-2026-007',
    title: 'Raamovereenkomst Buurtaanpak Stedin — netverzwaring stroomnet',
    principalDemoId: 'org_stedin',
    contractTypeSql: 'framework_agreement',
    valueEur: '291666666.00',
    startDate: '2026-04-01',
    endDate: '2034-03-31',
    statusSql: 'active',
    contractForm: 'UAV-GC',
    scopeSummary:
      'Buurtgerichte aanpak netverzwaring LS/MS-net in afgesproken werkgebieden in Zuid-Holland, Utrecht en Zeeland. Vaste teams gekoppeld aan Stedin-teams. Engineering, uitvoering, revisie, kort-cyclische opdrachten.',
  },
  {
    demoId: 'ct_combi_brabant',
    contractNumber: 'CB-ENX-BW-2025-001',
    title: 'Combi Brabant — uitbreiding/verzwaring elektriciteits- en drinkwaterleidingnet',
    principalDemoId: 'org_enexis',
    contractTypeSql: 'framework_agreement',
    valueEur: '225000000.00',
    startDate: '2025-09-01',
    endDate: '2037-08-31',
    statusSql: 'active',
    contractForm: 'Bouwteam + UAV-GC',
    scopeSummary:
      'Gecombineerde aanleg, vernieuwing en verzwaring van het elektriciteits- (Enexis) en drinkwaterleidingnet (Brabant Water) in Noord-Brabant. Lange-termijn strategische samenwerking met Hurkmans, BGM en APK/Rasenberg.',
  },
  {
    demoId: 'ct_grondg_no_nl',
    contractNumber: "GRONDG-NO-2023-004",
    title: "Raamovereenkomst GROND'G — gecombineerde infra Noord-Oost Nederland",
    principalDemoId: 'org_grondg',
    contractTypeSql: 'framework_agreement',
    valueEur: '175000000.00',
    startDate: '2023-11-01',
    endDate: '2031-10-31',
    statusSql: 'active',
    contractForm: 'UAV-GC + RAW',
    scopeSummary:
      'Gecombineerde uitvoering energie-, drinkwater- en telecominfra voor Enexis, Coteq, Rendo, Vitens, Waterbedrijf Groningen, WMD en VodafoneZiggo in Groningen, Drenthe en Overijssel. Werkgebieden Drenthe-Zuid en Overijssel-Noord.',
  },
  {
    demoId: 'ct_structin_mw',
    contractNumber: 'STR-MW-2022-012',
    title: 'Structin Werkgebieden Midden & West — gecombineerde KCO',
    principalDemoId: 'org_structin',
    contractTypeSql: 'framework_agreement',
    valueEur: '48000000.00',
    startDate: '2022-01-01',
    endDate: '2027-12-31',
    statusSql: 'active',
    contractForm: 'RAW-bestek + KCO',
    scopeSummary:
      "Kort Cyclische Opdrachten (KCO) voor gecombineerde aanleg kabels & leidingen bij nieuwbouw in Zuid-Holland. ~75 collega's dagelijks. Digitale opdrachtverstrekking via DSP, revisie via GO MapForms.",
  },
  {
    demoId: 'ct_mdso',
    contractNumber: 'MDSO-2023-019',
    title: 'Raamovereenkomst MDSO — multi-utility Stedin/Dunea/Oasen',
    principalDemoId: 'org_stedin',
    contractTypeSql: 'framework_agreement',
    valueEur: '62000000.00',
    startDate: '2023-10-19',
    endDate: '2030-10-18',
    statusSql: 'active',
    contractForm: 'UAV-GC',
    scopeSummary:
      'Gezamenlijke aanleg en vervanging van elektriciteitskabels, gas- en drinkwaterleidingen door Stedin, Dunea en Oasen. Reductie omgevingshinder door gebundelde uitvoering.',
  },
  {
    demoId: 'ct_odf_capelle',
    contractNumber: 'ODF-CAP-2024-003',
    title: 'Hoogbouwaansluitingen Open Dutch Fiber Capelle aan den IJssel',
    principalDemoId: 'org_odf',
    contractTypeSql: 'project_contract',
    valueEur: '18500000.00',
    startDate: '2024-06-01',
    endDate: '2027-12-31',
    statusSql: 'active',
    contractForm: 'UAV-GC',
    scopeSummary:
      '15.750 hoogbouwwoningen voorzien van gratis glasvezelaansluitingen op ODF-infrastructuur. Inclusief inpandige montage, patchpanelen, civiel werk pand-entree.',
  },
]

type ExecProject = {
  demoId: string
  projectCode: string
  name: string
  contractDemoId: string | null
  principalDemoId: string
  location: string
  startDate: string
  endDate: string
  status: string
  valueEur: string
  scope: string
  technicalScope: string
}

const EXEC_PROJECTS: ExecProject[] = [
  {
    demoId: 'prj_nulelie_fas3',
    projectCode: 'NL-FAS3-2026',
    name: 'NuLelie Fase 3 — 20 kV-ringen Zuidwest-Friesland',
    contractDemoId: 'ct_grondg_no_nl',
    principalDemoId: 'org_liander',
    location: 'Friesland (Lemmer–Sneek–Bolsward)',
    startDate: '2026-04-01',
    endDate: '2029-12-31',
    status: 'active',
    valueEur: '14200000.00',
    scope:
      "Aanleg 20 kV-ringstructuur ter vervanging van vermaasd 10 kV-net. Inclusief plaatsing nieuwe DSR's, ombouw bestaande RMU's, vervanging trafo 110/10 kV door 110/20 kV bij onderstation.",
    technicalScope:
      "MS-kabel GPLK 3x1x240 Al; ~38 km tracé; 14 nieuwe distributiestations; 2x 110/20 kV trafo's; Relatics-gestuurd ontwerp; SE-aanpak",
  },
  {
    demoId: 'prj_warns_oudemirdum',
    projectCode: 'NL-WO-2023-001',
    name: 'MS-route + waterleiding Warns–Oudemirdum',
    contractDemoId: 'ct_grondg_no_nl',
    principalDemoId: 'org_liander',
    location: 'Friesland (Warns–Oudemirdum)',
    startDate: '2023-03-01',
    endDate: '2023-11-30',
    status: 'completed',
    valueEur: '8900000.00',
    scope:
      '14 km gecombineerde aanleg nieuwe middenspanningsroute en drinkwaterhoofdleiding. Samenwerking Liander–Vitens–Baas in driekwart jaar gerealiseerd.',
    technicalScope: 'MS-kabel 20 kV ~14 km; PE-waterleiding DN300; 4x gestuurde boring onder N-wegen; revisie binnen 24u via DSP/GMF',
  },
  {
    demoId: 'prj_waterstof_wagenborgen',
    projectCode: 'WSW-2022-001',
    name: 'WaterstofWijk Wagenborgen — distributienet + WOS Siddeburen',
    contractDemoId: null,
    principalDemoId: 'org_enexis',
    location: 'Wagenborgen / Siddeburen (GR)',
    startDate: '2022-10-01',
    endDate: '2024-06-30',
    status: 'completed',
    valueEur: '4750000.00',
    scope:
      'Aanleg 2 km waterstoftransportleiding van Eelshuis Energie (Siddeburen) naar Wagenborgen + WOS-plateau + lokaal distributienet voor 33 jaren-70 huurwoningen. Eerste waterstof woonwijk van Nederland.',
    technicalScope:
      'Waterstofleiding 8 bar PE100-RC DN90; WOS met drukreductie en odorisatie; aansluiting hybride warmtepomp + H2-ketel Intergas',
  },
  {
    demoId: 'prj_zalmhaven',
    projectCode: 'STD-ZAL-2021-008',
    name: 'Zalmhaventoren Rotterdam — energie-infra hoogbouw',
    contractDemoId: 'ct_stedin_buurt_2026',
    principalDemoId: 'org_stedin',
    location: 'Rotterdam — Wilhelminapier',
    startDate: '2021-09-01',
    endDate: '2026-12-31',
    status: 'active',
    valueEur: '6200000.00',
    scope:
      'Aanleg MS-aansluiting, transformatorruimten en LS-distributie voor de hoogste woontoren van NL/Benelux (215 m). Inclusief noodstroom en walstroom-koppeling met Cruise Terminal.',
    technicalScope: '2x MS-trafo 1000 kVA; redundante MS-ring; 3 tussenverdelingen op +60m, +120m, +180m',
  },
  {
    demoId: 'prj_odf_zaanstad',
    projectCode: 'ODF-ZAA-2023-022',
    name: 'Glasvezelaanleg Zaanstad — DELTA Netwerk',
    contractDemoId: null,
    principalDemoId: 'org_delta',
    location: 'Zaanstad',
    startDate: '2023-10-19',
    endDate: '2025-06-30',
    status: 'completed',
    valueEur: '7300000.00',
    scope:
      'Aanleg glasvezelnetwerk in opdracht van DELTA Netwerk i.s.m. gemeente Zaanstad. ~1.200 adressen aangesloten op nieuw glasvezelnetwerk.',
    technicalScope: 'FTTH; ~52 km blow-fibre buisinfra; 1.200 huisaansluitingen; civiel + revisie NLCS',
  },
  {
    demoId: 'prj_rooswijk',
    projectCode: 'LIA-RWK-2024-003',
    name: 'Buurtaanpak Rooswijk Zaandijk — MS- & LS-verzwaring',
    contractDemoId: null,
    principalDemoId: 'org_liander',
    location: 'Zaandijk — wijk Rooswijk',
    startDate: '2024-02-15',
    endDate: '2025-08-31',
    status: 'completed',
    valueEur: '5600000.00',
    scope:
      'Eerste Buurtaanpak-project Liander. Aanleg 10 nieuwe MS-ruimtes, verzwaring 5 bestaande. Uitbreiding MS-net ~4 km. Vervanging LS-kabels en aansluitingen waar nodig.',
    technicalScope: '10 nieuwe DSR (compactstation Alfen Diabolo); MS-kabel ~4 km; LS-verzwaring; communicatie via BouwApp',
  },
  {
    demoId: 'prj_zeerijp',
    projectCode: 'ENX-ZRP-2022-014',
    name: 'Verhelpen spanningsklachten Zeerijp',
    contractDemoId: 'ct_grondg_no_nl',
    principalDemoId: 'org_enexis',
    location: 'Zeerijp (GR)',
    startDate: '2022-04-01',
    endDate: '2023-03-31',
    status: 'completed',
    valueEur: '1850000.00',
    scope:
      'Engineering + uitvoering. Vervanging 2,5 km LS-net (asbest/koper), 800 m OV-net, 500 m MS-net, 1 netstation, 4 verdeelkasten. Dorpkernen Kwekersweg/Molenweg/Borgweg/Eenumerweg.',
    technicalScope: 'LS Al 4x150 mm² 2,5 km; MS GPLK 500 m; 1 compactstation; 4 verdeelkasten Hazemeijer',
  },
  {
    demoId: 'prj_odf_capelle_fase1',
    projectCode: 'ODF-CAP-F1-2024',
    name: 'ODF Capelle a/d IJssel — Hoogbouw Fase 1',
    contractDemoId: 'ct_odf_capelle',
    principalDemoId: 'org_odf',
    location: 'Capelle aan den IJssel',
    startDate: '2024-06-01',
    endDate: '2025-12-31',
    status: 'active',
    valueEur: '5400000.00',
    scope: 'Eerste tranche: ~4.500 hoogbouwwoningen voorzien van glasvezelaansluitingen.',
    technicalScope: 'FTTH; verticale stijgleidingen; centrale POP per complex; meterkast-patches',
  },
  {
    demoId: 'prj_walstroom_rdam',
    projectCode: 'STD-WAL-2023-004',
    name: 'Walstroom Cruise Terminal Rotterdam',
    contractDemoId: 'ct_mdso',
    principalDemoId: 'org_stedin',
    location: 'Rotterdam — Wilhelminapier',
    startDate: '2023-09-01',
    endDate: '2024-08-31',
    status: 'completed',
    valueEur: '3400000.00',
    scope:
      'Aanleg ~2 km 10 kV-kabels van transformatorstation Putselaan naar Cruise Terminal voor walstroomvoorziening cruiseschepen. Coördinatie rondom marathon, Koningsdag en Afrikaandermarkt.',
    technicalScope: '10 kV kabel 3x1x630 Al ~2 km; 2x gestuurde boring; aansluitveld Cruise Port Shore Power BV',
  },
  {
    demoId: 'prj_vossendaal',
    projectCode: 'VWP-2024-001',
    name: 'Vossendaal Windpark — kabelverbindingen herstructurering',
    contractDemoId: null,
    principalDemoId: 'org_liander',
    location: 'Vossendaal',
    startDate: '2024-09-01',
    endDate: '2025-12-31',
    status: 'active',
    valueEur: '2200000.00',
    scope:
      'Herinrichting park: vervanging 5 oudere windmolens door 3 zwaardere. Nieuwe kabelverbindingen, verzwaring naar 33 kV-aansluitpunt.',
    technicalScope: 'MS-kabel 33 kV ~3,2 km; nieuwe inkoppeling onderstation; engineering tracé',
  },
  {
    demoId: 'prj_nulelie_dsr',
    projectCode: 'NL-DSR-2027',
    name: 'NuLelie — DSR-pakket Noordoostpolder',
    contractDemoId: 'ct_grondg_no_nl',
    principalDemoId: 'org_liander',
    location: 'Noordoostpolder (FL)',
    startDate: '2027-01-01',
    endDate: '2030-06-30',
    status: 'planned',
    valueEur: '9800000.00',
    scope:
      "Plaatsing 22 nieuwe distributieruimtes (DSR's) ter ondersteuning van nieuwe 20 kV-ring. Engineering, civiel, montage, inbedrijfname.",
    technicalScope: "22 DSR (compactstation); MS-veld 24 kV; SCADA-integratie via Liander DMS",
  },
]

/** Placeholderprojecten voor raamcontracten zonder uitvoeringsproject in de seed. */
const PLACEHOLDER_PROJECTS: Array<{ projectCode: string; name: string; contractDemoId: string; principalDemoId: string }> = [
  {
    projectCode: 'CB-PLACE-001',
    name: 'Combi Brabant — programma (demokoppeling)',
    contractDemoId: 'ct_combi_brabant',
    principalDemoId: 'org_enexis',
  },
  {
    projectCode: 'STR-PLACE-001',
    name: 'Structin Midden & West — programma (demokoppeling)',
    contractDemoId: 'ct_structin_mw',
    principalDemoId: 'org_structin',
  },
]

type DocRow = {
  id: string
  contractDemoId: string
  documentType: string
  title: string
  version: string
  signedDate: string
  fileRef: string
}

const DEMO_DOCS: DocRow[] = [
  { id: 'doc_001', contractDemoId: 'ct_stedin_buurt_2026', documentType: 'framework_agreement', title: 'Raamovereenkomst Buurtaanpak Stedin', version: '1.0', signedDate: '2026-01-27', fileRef: 'demo://STD-BUURT-2026-007/raam.pdf' },
  { id: 'doc_002', contractDemoId: 'ct_stedin_buurt_2026', documentType: 'sla', title: 'SLA — Reactietijden & Beschikbaarheid', version: '1.0', signedDate: '2026-01-27', fileRef: 'demo://STD-BUURT-2026-007/sla.pdf' },
  { id: 'doc_003', contractDemoId: 'ct_stedin_buurt_2026', documentType: 'pricing_schedule', title: 'Prijzenboek Buurtaanpak (categorieën A–F)', version: '1.0', signedDate: '2026-01-27', fileRef: 'demo://STD-BUURT-2026-007/prijs.xlsx' },
  { id: 'doc_004', contractDemoId: 'ct_stedin_buurt_2026', documentType: 'kpi_schedule', title: "KPI's & Bonus/Malus regeling", version: '1.0', signedDate: '2026-01-27', fileRef: 'demo://STD-BUURT-2026-007/kpi.pdf' },
  { id: 'doc_010', contractDemoId: 'ct_combi_brabant', documentType: 'framework_agreement', title: 'Raamovereenkomst Combi Brabant', version: '1.0', signedDate: '2025-09-15', fileRef: 'demo://CB-ENX-BW-2025-001/raam.pdf' },
  { id: 'doc_011', contractDemoId: 'ct_combi_brabant', documentType: 'bouwteam_agreement', title: 'Bouwteamovereenkomst — Fase 1', version: '1.0', signedDate: '2025-09-15', fileRef: 'demo://CB-ENX-BW-2025-001/bouwteam.pdf' },
  { id: 'doc_012', contractDemoId: 'ct_combi_brabant', documentType: 'technical_specs', title: 'Technische specificaties — water/elektra combi', version: '2.1', signedDate: '2025-09-15', fileRef: 'demo://CB-ENX-BW-2025-001/tech.pdf' },
  { id: 'doc_020', contractDemoId: 'ct_grondg_no_nl', documentType: 'framework_agreement', title: "Raamovereenkomst GROND'G NO-NL", version: '1.2', signedDate: '2023-11-01', fileRef: 'demo://GRONDG-NO-2023-004/raam.pdf' },
  { id: 'doc_021', contractDemoId: 'ct_grondg_no_nl', documentType: 'allocation_protocol', title: 'Werkverdelingsprotocol percelen', version: '1.0', signedDate: '2023-11-01', fileRef: 'demo://GRONDG-NO-2023-004/verdeling.pdf' },
  { id: 'doc_022', contractDemoId: 'ct_grondg_no_nl', documentType: 'safety_addendum', title: 'Veiligheidsbijlage Safety Culture Ladder 4', version: '1.0', signedDate: '2024-03-01', fileRef: 'demo://GRONDG-NO-2023-004/scl4.pdf' },
  { id: 'doc_030', contractDemoId: 'ct_structin_mw', documentType: 'framework_agreement', title: 'Raamovereenkomst Structin MW', version: '2.0', signedDate: '2022-01-01', fileRef: 'demo://STR-MW-2022-012/raam.pdf' },
  { id: 'doc_031', contractDemoId: 'ct_structin_mw', documentType: 'kco_specs', title: 'KCO-bestek nieuwbouw woningbouw', version: '2.0', signedDate: '2022-01-01', fileRef: 'demo://STR-MW-2022-012/kco.pdf' },
  { id: 'doc_032', contractDemoId: 'ct_structin_mw', documentType: 'dsp_addendum', title: 'DSP-koppelingsovereenkomst (digitaal)', version: '1.1', signedDate: '2023-06-01', fileRef: 'demo://STR-MW-2022-012/dsp.pdf' },
  { id: 'doc_040', contractDemoId: 'ct_mdso', documentType: 'framework_agreement', title: 'Raamovereenkomst MDSO Stedin/Dunea/Oasen', version: '1.0', signedDate: '2023-10-19', fileRef: 'demo://MDSO-2023-019/raam.pdf' },
  { id: 'doc_041', contractDemoId: 'ct_mdso', documentType: 'coordination_protocol', title: 'Coördinatieprotocol gecombineerd graven', version: '1.0', signedDate: '2023-10-19', fileRef: 'demo://MDSO-2023-019/coord.pdf' },
  { id: 'doc_050', contractDemoId: 'ct_odf_capelle', documentType: 'project_contract', title: 'Projectcontract ODF Capelle hoogbouw', version: '1.0', signedDate: '2024-05-15', fileRef: 'demo://ODF-CAP-2024-003/contract.pdf' },
  { id: 'doc_051', contractDemoId: 'ct_odf_capelle', documentType: 'technical_specs', title: 'TSD hoogbouwaansluitingen ODF', version: '3.2', signedDate: '2024-05-15', fileRef: 'demo://ODF-CAP-2024-003/tsd.pdf' },
]

type ClauseRow = {
  id: string
  contractDemoId: string
  clauseType: string
  summary: string
  riskLevel: string
  aiFlagged: boolean
}

const CLAUSES: ClauseRow[] = [
  { id: 'clause_001', contractDemoId: 'ct_stedin_buurt_2026', clauseType: 'liability_cap', summary: 'Aansprakelijkheid begrensd tot 25% jaarwaarde per gebeurtenis, max. 50% jaarwaarde per jaar.', riskLevel: 'medium', aiFlagged: false },
  { id: 'clause_002', contractDemoId: 'ct_stedin_buurt_2026', clauseType: 'price_indexation', summary: 'Indexering jaarlijks per 1 januari op basis CBS-index 412 GWW.', riskLevel: 'low', aiFlagged: false },
  { id: 'clause_003', contractDemoId: 'ct_stedin_buurt_2026', clauseType: 'termination_convenience', summary: 'Opdrachtgever kan eenzijdig opzeggen met 12 maanden opzegtermijn.', riskLevel: 'high', aiFlagged: true },
  { id: 'clause_004', contractDemoId: 'ct_stedin_buurt_2026', clauseType: 'kpi_malus', summary: 'Bij <90% beschikbaarheid vast team: malus 2% van perioderekening.', riskLevel: 'medium', aiFlagged: true },
  { id: 'clause_005', contractDemoId: 'ct_stedin_buurt_2026', clauseType: 'safety_certification', summary: 'Verplicht SCL trede 4 binnen 12 maanden na ondertekening.', riskLevel: 'low', aiFlagged: false },
  { id: 'clause_010', contractDemoId: 'ct_combi_brabant', clauseType: 'shared_responsibility', summary: 'Gedeelde verantwoordelijkheid Enexis/Brabant Water bij gecombineerde graafwerkzaamheden — split-clausule.', riskLevel: 'high', aiFlagged: true },
  { id: 'clause_011', contractDemoId: 'ct_combi_brabant', clauseType: 'volume_commitment', summary: 'Geen minimumafnamegarantie; werkverdeling op basis van prestatie en capaciteit.', riskLevel: 'high', aiFlagged: true },
  { id: 'clause_012', contractDemoId: 'ct_combi_brabant', clauseType: 'change_management', summary: 'Wijzigingen via formele VTW-procedure binnen 10 werkdagen.', riskLevel: 'low', aiFlagged: false },
  { id: 'clause_020', contractDemoId: 'ct_grondg_no_nl', clauseType: 'force_majeure', summary: 'Standaard overmachtsclausule conform UAV-GC 2005 §44.', riskLevel: 'low', aiFlagged: false },
  { id: 'clause_021', contractDemoId: 'ct_grondg_no_nl', clauseType: 'retention', summary: '5% inhouding tot oplevering + 12 mnd onderhoudstermijn.', riskLevel: 'medium', aiFlagged: false },
  { id: 'clause_022', contractDemoId: 'ct_grondg_no_nl', clauseType: 'subcontracting', summary: 'Onderaanneming >€500k vooraf schriftelijk goedkeuren.', riskLevel: 'medium', aiFlagged: false },
  { id: 'clause_023', contractDemoId: 'ct_grondg_no_nl', clauseType: 'data_ownership', summary: 'Alle revisiedata (NLCS, GIS) eigendom opdrachtgever; Baas heeft gebruiksrecht voor 5 jaar na oplevering.', riskLevel: 'medium', aiFlagged: true },
  { id: 'clause_030', contractDemoId: 'ct_structin_mw', clauseType: 'sla_revisie', summary: 'Revisie binnen 24 uur na oplevering verplicht via DSP/GMF.', riskLevel: 'medium', aiFlagged: true },
  { id: 'clause_031', contractDemoId: 'ct_structin_mw', clauseType: 'auto_renewal', summary: 'Stilzwijgende verlenging met 1 jaar tenzij opgezegd 6 mnd voor einde.', riskLevel: 'medium', aiFlagged: true },
  { id: 'clause_040', contractDemoId: 'ct_mdso', clauseType: 'cost_split', summary: 'Kostenverdeling per asset-type: elektra 45% / water 35% / gas 20%.', riskLevel: 'medium', aiFlagged: false },
  { id: 'clause_041', contractDemoId: 'ct_mdso', clauseType: 'omgevingshinder_kpi', summary: 'Maximaal 3 gegronde klachten per 100m tracé; daarboven malus.', riskLevel: 'medium', aiFlagged: true },
  { id: 'clause_050', contractDemoId: 'ct_odf_capelle', clauseType: 'completion_bonus', summary: 'Bonus 1,5% bij oplevering >2 mnd voor deadline per fase.', riskLevel: 'low', aiFlagged: false },
  { id: 'clause_051', contractDemoId: 'ct_odf_capelle', clauseType: 'access_rights', summary: 'Bewonerstoegang via VvE-coördinatie; vertraging niet voor risico Baas.', riskLevel: 'medium', aiFlagged: true },
]

type KeyDateRow = {
  id: string
  contractDemoId: string
  eventType: string
  dueDate: string
  owner: string
  notes: string
}

const KEY_DATES: KeyDateRow[] = [
  { id: 'kd_001', contractDemoId: 'ct_stedin_buurt_2026', eventType: 'kpi_review', dueDate: '2026-10-01', owner: 'Account Stedin', notes: 'Eerste KPI-review na 6 mnd uitvoering' },
  { id: 'kd_002', contractDemoId: 'ct_stedin_buurt_2026', eventType: 'price_indexation', dueDate: '2027-01-01', owner: 'Inkoop Baas', notes: 'Jaarlijkse indexatie CBS-index 412' },
  { id: 'kd_003', contractDemoId: 'ct_combi_brabant', eventType: 'bouwteam_milestone', dueDate: '2026-03-31', owner: 'PM Combi', notes: 'Afronding bouwteamfase, transitie naar UAV-GC' },
  { id: 'kd_004', contractDemoId: 'ct_grondg_no_nl', eventType: 'tussenevaluatie', dueDate: '2026-11-01', owner: "Account GROND'G", notes: 'Tussenevaluatie na 3 jaar — verlengingsbeslissing' },
  { id: 'kd_005', contractDemoId: 'ct_structin_mw', eventType: 'opzegdeadline', dueDate: '2027-06-30', owner: 'Contractbeheer', notes: 'Laatste opzegmogelijkheid voor stilzwijgende verlenging' },
  { id: 'kd_006', contractDemoId: 'ct_mdso', eventType: 'kostenherijking', dueDate: '2026-10-19', owner: 'Finance', notes: 'Driejaarlijkse herijking kostenverdeelsleutel' },
  { id: 'kd_007', contractDemoId: 'ct_odf_capelle', eventType: 'fase1_oplevering', dueDate: '2025-12-31', owner: 'PM ODF', notes: 'Mijlpaal Fase 1 — bonusclausule actief' },
]

function docKindFromType(t: string): 'hoofdcontract' | 'contractstuk' | 'addendum' {
  if (t === 'framework_agreement' || t === 'project_contract') return 'hoofdcontract'
  if (t === 'sla' || t === 'bouwteam_agreement' || t === 'safety_addendum' || t === 'dsp_addendum') return 'addendum'
  return 'contractstuk'
}

function contractTypeLabel(sql: DemoContractRow['contractTypeSql']): string {
  return sql === 'framework_agreement' ? 'Raamovereenkomst' : 'Projectcontract'
}

function projectDescription(p: ExecProject | (typeof PLACEHOLDER_PROJECTS)[number], principalName: string): string {
  if ('scope' in p) {
    const ep = p as ExecProject
    return [
      `Demo-project (${ep.demoId})`,
      `Code: ${ep.projectCode} | Status: ${ep.status} | Waarde: €${ep.valueEur}`,
      `Opdrachtgever: ${principalName}`,
      `Locatie: ${ep.location}`,
      `Periode: ${ep.startDate} — ${ep.endDate}`,
      ep.contractDemoId ? `Raamcontract (demo): ${ep.contractDemoId}` : 'Geen raamcontract in demo-SQL',
      '',
      ep.scope,
      '',
      `Technisch: ${ep.technicalScope}`,
    ].join('\n')
  }
  const ph = p as (typeof PLACEHOLDER_PROJECTS)[number]
  return [
    `Placeholder programma (${ph.contractDemoId})`,
    `Code: ${ph.projectCode}`,
    `Opdrachtgever: ${principalName}`,
  ].join('\n')
}

async function main() {
  console.log('🌱 Baas B.V. demodata…\n')

  let org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, ORG_SLUG),
  })
  if (!org) {
    const [created] = await db
      .insert(schema.organizations)
      .values({
        name: 'Baas B.V.',
        slug: ORG_SLUG,
        settingsJson: { theme: 'default', demo: 'baas-infra' },
      })
      .returning()
    org = created
    console.log(`✓ Organisatie aangemaakt: ${org.name} (${org.id})`)
  } else {
    console.log(`↩ Organisatie bestond al: ${org.name} (${org.id})`)
  }

  const clerkId = 'seed_baas_demo_manager'
  let manager = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkId),
  })
  if (!manager) {
    const [u] = await db
      .insert(schema.users)
      .values({
        clerkId,
        orgId: org.id,
        role: 'manager',
        name: 'Demo Contractbeheer Baas',
        email: 'contractbeheer.demo@baasbv.nl',
      })
      .returning()
    manager = u
    console.log(`✓ Demo-gebruiker: ${manager.email}`)
  } else {
    await db
      .update(schema.users)
      .set({ orgId: org.id })
      .where(eq(schema.users.id, manager.id))
    console.log(`↩ Demo-gebruiker bestond al: ${manager.email}`)
  }

  const member = await db.query.organizationMembers.findFirst({
    where: and(eq(schema.organizationMembers.userId, manager.id), eq(schema.organizationMembers.orgId, org.id)),
  })
  if (!member) {
    await db.insert(schema.organizationMembers).values({
      userId: manager.id,
      orgId: org.id,
      role: 'manager',
    })
  }

  const supplierByDemoId = new Map<string, string>()

  for (const c of COUNTERPARTIES) {
    const existing = await db.query.suppliers.findFirst({
      where: and(eq(schema.suppliers.orgId, org.id), eq(schema.suppliers.kvk, c.kvk)),
    })
    if (existing) {
      supplierByDemoId.set(c.demoId, existing.id)
      continue
    }
    const [s] = await db
      .insert(schema.suppliers)
      .values({
        orgId: org.id,
        name: c.name,
        kvk: c.kvk,
        contactEmail: `demo+${c.demoId}@baas-seed.local`,
        contactName: 'Demo contact',
        metadataJson: { demoId: c.demoId, segment: c.segment, orgType: c.type, seed: 'baas-infra' },
      })
      .returning()
    supplierByDemoId.set(c.demoId, s.id)
    console.log(`✓ Leverancier/opdrachtgever: ${c.name}`)
  }

  const orgName = (demoId: string) => COUNTERPARTIES.find((x) => x.demoId === demoId)?.name ?? demoId

  type ProjectRow = typeof schema.projects.$inferSelect
  const projectByDemoId = new Map<string, string>()

  async function ensureProject(
    demoId: string,
    projectCode: string,
    name: string,
    description: string
  ): Promise<ProjectRow> {
    const fullName = `${projectCode} — ${name}`
    const existing = await db.query.projects.findFirst({
      where: and(eq(schema.projects.orgId, org!.id), eq(schema.projects.name, fullName)),
    })
    if (existing) {
      projectByDemoId.set(demoId, existing.id)
      return existing
    }
    const [p] = await db
      .insert(schema.projects)
      .values({
        orgId: org!.id,
        name: fullName,
        description,
      })
      .returning()
    projectByDemoId.set(demoId, p.id)
    console.log(`✓ Project: ${fullName}`)
    return p
  }

  for (const ph of PLACEHOLDER_PROJECTS) {
    await ensureProject(
      `placeholder_${ph.contractDemoId}`,
      ph.projectCode,
      ph.name,
      projectDescription(ph, orgName(ph.principalDemoId))
    )
  }

  for (const ep of EXEC_PROJECTS) {
    await ensureProject(ep.demoId, ep.projectCode, ep.name, projectDescription(ep, orgName(ep.principalDemoId)))
  }

  /** Eerste uitvoeringsproject per raamcontract voor contract.projectId */
  const primaryProjectByContract = new Map<string, string>()
  for (const ep of EXEC_PROJECTS) {
    if (!ep.contractDemoId) continue
    if (!primaryProjectByContract.has(ep.contractDemoId)) {
      primaryProjectByContract.set(ep.contractDemoId, projectByDemoId.get(ep.demoId)!)
    }
  }
  for (const ph of PLACEHOLDER_PROJECTS) {
    if (!primaryProjectByContract.has(ph.contractDemoId)) {
      primaryProjectByContract.set(ph.contractDemoId, projectByDemoId.get(`placeholder_${ph.contractDemoId}`)!)
    }
  }

  const relatedProjectsMeta = (contractDemoId: string) => {
    const ids = EXEC_PROJECTS.filter((p) => p.contractDemoId === contractDemoId).map((p) => ({
      demoId: p.demoId,
      code: p.projectCode,
      projectId: projectByDemoId.get(p.demoId),
    }))
    return { demoContractId: contractDemoId, relatedDemoProjects: ids }
  }

  const contractIdByDemo = new Map<string, string>()

  for (const dc of DEMO_CONTRACTS) {
    const exists = await db.query.contracts.findFirst({
      where: and(eq(schema.contracts.orgId, org.id), eq(schema.contracts.contractNumber, dc.contractNumber)),
    })
    if (exists) {
      contractIdByDemo.set(dc.demoId, exists.id)
      console.log(`↩ Contract bestond al: ${dc.contractNumber}`)
      continue
    }

    const supplierId = supplierByDemoId.get(dc.principalDemoId)
    if (!supplierId) {
      console.warn(`⚠ Geen leverancier voor ${dc.principalDemoId}, contract overgeslagen`)
      continue
    }

    const projectId = primaryProjectByContract.get(dc.demoId) ?? null
    const retentionYears = 7
    const end = new Date(dc.endDate)
    const destructionDate = new Date(end.getTime() + retentionYears * 365 * 86400000)

    const [row] = await db
      .insert(schema.contracts)
      .values({
        orgId: org.id,
        projectId,
        title: dc.title,
        contractNumber: dc.contractNumber,
        status: 'actief',
        contractType: contractTypeLabel(dc.contractTypeSql),
        supplierId,
        ownerUserId: manager.id,
        startDate: new Date(dc.startDate),
        endDate: end,
        noticePeriodDays: dc.contractTypeSql === 'framework_agreement' ? 365 : 90,
        valueTotal: dc.valueEur,
        valueAnnual: null,
        currency: 'EUR',
        autoRenewal: dc.demoId === 'ct_structin_mw',
        autoRenewalTerms: dc.demoId === 'ct_structin_mw' ? 'Stilzwijgende verlenging 1 jaar, opzeggen 6 mnd voor afloop' : null,
        retentionYears,
        destructionDate,
        metadataJson: {
          seed: 'baas-infra',
          demoId: dc.demoId,
          contractForm: dc.contractForm,
          scopeSummary: dc.scopeSummary,
          sqlContractType: dc.contractTypeSql,
          contractorDemoId: 'org_baas',
          principalDemoId: dc.principalDemoId,
          ...relatedProjectsMeta(dc.demoId),
        },
        createdBy: manager.id,
        updatedAt: new Date(),
      })
      .returning()

    contractIdByDemo.set(dc.demoId, row.id)
    console.log(`✓ Contract: ${dc.contractNumber}`)
  }

  for (const d of DEMO_DOCS) {
    const contractId = contractIdByDemo.get(d.contractDemoId)
    if (!contractId) continue

    const safeName = `${d.id}-${d.title.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)}.pdf`
    const exists = await db.query.contractDocuments.findFirst({
      where: and(eq(schema.contractDocuments.contractId, contractId), eq(schema.contractDocuments.filename, safeName)),
    })
    if (exists) continue

    const isPdf = d.fileRef.endsWith('.pdf')
    await db.insert(schema.contractDocuments).values({
      contractId,
      filename: safeName,
      fileUrl: isPdf ? d.fileRef : DEMO_PDF,
      fileType: isPdf ? 'application/pdf' : 'application/octet-stream',
      fileSize: 2048,
      versionNumber: parseInt(d.version.split('.')[0], 10) || 1,
      isCurrent: true,
      documentKind: docKindFromType(d.documentType),
      uploadedBy: manager.id,
      uploadedAt: new Date(d.signedDate),
      aiProcessed: true,
      aiExtractedDataJson: {
        seed: 'baas-infra',
        demoDocId: d.id,
        documentType: d.documentType,
        fileRef: d.fileRef,
        title: d.title,
        version: d.version,
      },
    })
  }
  console.log(`✓ Contractdocumenten geïmporteerd (per contract waar nodig)`)

  for (const cl of CLAUSES) {
    const contractId = contractIdByDemo.get(cl.contractDemoId)
    if (!contractId) continue

    const desc = `[${cl.clauseType}] (${cl.riskLevel}${cl.aiFlagged ? ', AI' : ''}) ${cl.summary}`
    const dup = await db.query.contractObligations.findFirst({
      where: and(eq(schema.contractObligations.contractId, contractId), eq(schema.contractObligations.description, desc)),
    })
    if (dup) continue

    await db.insert(schema.contractObligations).values({
      contractId,
      description: desc,
      category: 'other',
      dueDate: null,
      status: 'open',
      recurring: false,
      extractedByAi: cl.aiFlagged,
    })
  }

  for (const kd of KEY_DATES) {
    const contractId = contractIdByDemo.get(kd.contractDemoId)
    if (!contractId) continue

    const desc = `[Mijlpaal ${kd.eventType}] ${kd.notes} (eigenaar: ${kd.owner})`
    const dup = await db.query.contractObligations.findFirst({
      where: and(eq(schema.contractObligations.contractId, contractId), eq(schema.contractObligations.description, desc)),
    })
    if (dup) continue

    await db.insert(schema.contractObligations).values({
      contractId,
      description: desc,
      category: 'financial',
      dueDate: new Date(kd.dueDate),
      status: 'open',
      recurring: false,
      extractedByAi: false,
    })
  }
  console.log(`✓ Clausules + mijlpalen als verplichtingen toegevoegd`)

  console.log('\n✅ Baas-demodata klaar. Organisatieslug:', ORG_SLUG)
  console.log('   Zie je Baas niet in de org-schakelaar? Voeg lidmaatschap toe:')
  console.log('   npm run db:add-org-member -- user_JOUW_CLERK_ID baas-bv-demo manager')
  console.log('   (daarna pagina vernieuwen; of: db:link-user om meteen actief op Baas te staan)\n')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ seed-baas-demo mislukt:', e instanceof Error ? e.message : e)
  process.exit(1)
})
