/**
 * Genereert eenvoudige maar leesbare Nederlandse contract-PDF’s voor seed-data (Blob).
 * Alleen gebruikt door scripts/seed.ts — geen runtime dependency van de app.
 */
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

export type SeedContractPdfInput = {
  orgName: string
  contractTitle: string
  contractNumber: string
  supplierName: string
  contractType: string | null
  startDate: Date | null
  endDate: Date | null
  noticePeriodDays: number | null
  valueTotal: string | null
  valueAnnual: string | null
  currency: string | null
  autoRenewal: boolean | null
  autoRenewalTerms: string | null
  /** Welk seed-bestand: hoofdovereenkomst, dienstenbijlage of orderbevestiging */
  seedDocKind: 'main' | 'annex' | 'order'
  versionNumber: number
}

const A4_W = 595
const A4_H = 842
const M = 50
const FONT_SIZE = 10
const TITLE_SIZE = 15
const HEADING_SIZE = 11
const LINE = 13
const MAX_W = A4_W - M * 2

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return format(d, 'd MMMM yyyy', { locale: nl })
}

function fmtMoney(amount: string | null, currency: string | null): string {
  if (amount == null || amount === '') return '—'
  const cur = currency ?? 'EUR'
  const n = Number(amount.replace(',', '.'))
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: cur }).format(n)
  }
  return `${amount} ${cur}`
}

function wrapLineToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      cur = next
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function wrapBlocks(paragraphs: string[], font: PDFFont, size: number): string[] {
  const out: string[] = []
  for (const p of paragraphs) {
    for (const line of p.split('\n')) {
      out.push(...wrapLineToWidth(line.trim(), font, size, MAX_W))
    }
    out.push('')
  }
  return out
}

type Layout = {
  pdf: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  fontBold: PDFFont
}

function ensureSpace(layout: Layout, need: number) {
  if (layout.y - need < M + 30) {
    layout.page = layout.pdf.addPage([A4_W, A4_H])
    layout.y = A4_H - M
  }
}

function drawHeading(layout: Layout, text: string) {
  ensureSpace(layout, LINE * 2)
  layout.page.drawText(text, {
    x: M,
    y: layout.y,
    size: HEADING_SIZE,
    font: layout.fontBold,
  })
  layout.y -= LINE + 6
}

function drawLines(layout: Layout, lines: string[], size = FONT_SIZE) {
  const font = layout.font
  for (const line of lines) {
    if (line === '') {
      layout.y -= LINE / 2
      continue
    }
    ensureSpace(layout, LINE)
    layout.page.drawText(line, { x: M, y: layout.y, size, font })
    layout.y -= LINE
  }
}

function metaBlock(input: SeedContractPdfInput): string[] {
  return [
    `Contractnummer: ${input.contractNumber}`,
    `Titel: ${input.contractTitle}`,
    `Type: ${input.contractType ?? '—'}`,
    `Partij afnemer: ${input.orgName}`,
    `Partij leverancier: ${input.supplierName}`,
    `Ingangsdatum: ${fmtDate(input.startDate)}`,
    `Einddatum / afloop: ${fmtDate(input.endDate)}`,
    `Opzegtermijn: ${input.noticePeriodDays != null ? `${input.noticePeriodDays} dagen` : '—'}`,
    `Waarde contract (totaal): ${fmtMoney(input.valueTotal, input.currency)}`,
    `Jaarbedrag (indicatief): ${fmtMoney(input.valueAnnual, input.currency)}`,
    `Stilzwijgende verlenging: ${input.autoRenewal ? 'Ja' : 'Nee'}`,
    input.autoRenewal && input.autoRenewalTerms
      ? `Voorwaarden verlenging: ${input.autoRenewalTerms}`
      : '',
  ].filter(Boolean)
}

function bodyMain(input: SeedContractPdfInput): string[] {
  return [
    'Partijen verklaren te zijn gerechtigd tot het aangaan van deze overeenkomst en spreken het volgende af.',
    '',
    'Artikel 1 — Voorwerp en reikwijdte',
    `Deze overeenkomst heeft betrekking op "${input.contractTitle}" zoals nader beschreven in de bijlagen en de tussen partijen uitgewisselde offertes. De leverancier verbindt zich de overeengekomen producten en/of diensten conform de geldende specificaties te leveren en, voor zover van toepassing, beschikbaarheid en ondersteuning te bewaken binnen de afgesproken kaders.`,
    '',
    'Artikel 2 — Looptijd en beëindiging',
    `De overeenkomst vangt aan op de ingangsdatum en eindigt op de einddatum, tenzij eerder opgezegd met inachtneming van de overeengekomen opzegtermijn. Bij niet tijdige opzegging kunnen partijen overeenkomen dat de overeenkomst tacit wordt verlengd; voorwaarden daarvan zijn in de metadata van dit voorbeelddocument opgenomen.`,
    '',
    'Artikel 3 — Vergoeding en facturatie',
    `De afnemer betaalt de overeengekomen vergoeding conform de facturatiegrondslag in deze overeenkomst. Jaarlijkse indexatie en eventuele meerkosten voor uitbreidingen worden slechts verschuldigd na schriftelijke instemming van beide partijen, tenzij uitdrukkelijk anders overeengekomen.`,
    '',
    'Artikel 4 — Service, SLA en storingen',
    'De leverancier levert ondersteuning binnen de in bijlage "Dienstenniveaus" omschreven responstijden. Structurele tekortkomingen worden gemeld aan het aangewezen contactpunt van de afnemer; partijen stemmen een herstelplan en communicatie daaromtrent af.',
    '',
    'Artikel 5 — Geheimhouding en gegevens',
    'Partijen verplichten zich tot geheimhouding van vertrouwelijke informatie. Waar sprake is van verwerking van persoonsgegevens, worden de verplichtingen uit de Algemene verordening gegevensbescherming (AVG) nageleefd en wordt zo nodig een verwerkersovereenkomst gesloten.',
    '',
    'Artikel 6 — Aansprakelijkheid',
    'De totale aansprakelijkheid van de leverancier is — behoudens opzet of grove schuld — per gebeurtenis beperkt tot het bedrag dat in het desbetreffende contractjaar aan de leverancier verschuldigd is, met een maximum zoals in aanvullende polis- of raamcontractvoorwaarden kan zijn vastgelegd.',
    '',
    'Artikel 7 — Overige bepalingen',
    'Wijzigingen van deze overeenkomst zijn slechts geldig indien schriftelijk overeengekomen. Op deze overeenkomst is Nederlands recht van toepassing. Geschillen worden bij voorkeur in overleg beslecht; bij uitblijven daarvan zijn de bevoegde rechter in het arrondissement van de afnemer en — voor consumenten — de wettige derdenrechten onverminderd van toepassing.',
    '',
    '(Dit document is automatisch gegenereerd als demonstratie-inhoud voor test- en ontwikkelomgevingen.)',
  ]
}

function bodyAnnex(input: SeedContractPdfInput): string[] {
  return [
    `Bijlage bij overeenkomst ${input.contractNumber}`,
    '',
    '1. Dienstcatalogus (samenvatting)',
    'Onder deze bijlage vallen de periodieke diensten, releases, patching, backlog-afhandeling en functioneel beheer zoals afgestemd in het implementatietraject. Afwijkingen worden vastgelegd in het wijzigingsregister.',
    '',
    '2. Rapportering',
    'De leverancier levert maandelijks een beknopt rapport met beschikbaarheid, incidenten (P1–P4), doorlooptijden en geplande onderhoudsvensters. De afnemer kan om een nadere toelichting verzoeken binnen tien werkdagen.',
    '',
    '3. Escalatie',
    'Eerste lijn: service desk van de leverancier. Tweede lijn: contractmanager aan leverancierszijde. Derde lijn: steering committee met vertegenwoordigers van beide organisaties op kwartaalbasis of bij structurele afwijkingen van het dienstenniveau.',
    '',
    '4. Subcontractanten',
    'Inzet van subprocessors vindt plaats conform de verplichtingen uit de hoofdovereenkomst en — waar vereist — na voorafgaande kennisgeving aan de afnemer.',
    '',
    '(Demonstratie-inhoud; geen juridisch advies.)',
  ]
}

function bodyOrder(input: SeedContractPdfInput): string[] {
  return [
    `Orderbevestiging — verwijzend naar ${input.contractNumber}`,
    '',
    'Ondergetekenden bevestigen dat de order conform de getekende hoofdovereenkomst en van toepassing zijnde prijsafspraken is geplaatst. Levering en facturatie geschieden volgens de daar beschikbare clausules; deze order vervangt geen bepalingen uit de hoofdovereenkomst, tenzij uitdrukkelijk anders vermeld.',
    '',
    `Orderversie / documentversie in register: ${input.versionNumber}.`,
    '',
    'Datum order: ' + fmtDate(input.startDate),
    '',
    '(Gegenereerde demo-inhoud.)',
  ]
}

export async function buildSeedContractPdfBuffer(input: SeedContractPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([A4_W, A4_H])
  let y = A4_H - M

  const layout: Layout = { pdf, page, y, font, fontBold }

  ensureSpace(layout, TITLE_SIZE + LINE * 3)
  layout.page.drawText('UNIVERSITEIT LEIDEN — CONTRACTDOCUMENT (SEED)', {
    x: M,
    y: layout.y,
    size: TITLE_SIZE,
    font: fontBold,
  })
  layout.y -= LINE * 2

  const subtitle =
    input.seedDocKind === 'main'
      ? 'Hoofdovereenkomst'
      : input.seedDocKind === 'annex'
        ? 'Bijlage diensten / specificatie'
        : 'Orderbevestiging'
  layout.page.drawText(subtitle, { x: M, y: layout.y, size: HEADING_SIZE, font: fontBold })
  layout.y -= LINE * 2

  drawHeading(layout, 'Gegevens')
  drawLines(layout, wrapBlocks(metaBlock(input), font, FONT_SIZE))

  const body =
    input.seedDocKind === 'main' ? bodyMain(input) : input.seedDocKind === 'annex' ? bodyAnnex(input) : bodyOrder(input)
  drawHeading(layout, input.seedDocKind === 'main' ? 'Clausules' : 'Inhoud bijlage')
  drawLines(layout, wrapBlocks(body, font, FONT_SIZE))

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}
