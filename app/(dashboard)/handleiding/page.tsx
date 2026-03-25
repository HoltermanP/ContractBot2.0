import type { ComponentType, ReactNode } from 'react'
import { getOrCreateUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, STATUS_LABELS } from '@/lib/utils'
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  Info,
  Shield,
  Sparkles,
  FileText,
  Settings,
  Database,
} from 'lucide-react'

const toc = [
  { id: 'intro', label: 'Inleiding' },
  { id: 'start', label: 'Aan de slag' },
  { id: 'rollen', label: 'Rollen en rechten' },
  { id: 'navigatie', label: 'Schermen en menu' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'contracten', label: 'Contracten' },
  { id: 'detail', label: 'Contractdetail' },
  { id: 'documenten', label: 'Documenten en opslag' },
  { id: 'leveranciers', label: 'Leveranciers' },
  { id: 'zoeken', label: 'Zoeken' },
  { id: 'rapportages', label: 'Rapportages' },
  { id: 'ai', label: 'AI-functies' },
  { id: 'instellingen', label: 'Instellingen' },
  { id: 'techniek', label: 'Techniek en omgeving' },
  { id: 'faq', label: 'Tips en FAQ' },
]

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string
  title: string
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
            {Icon && <Icon className="h-5 w-5 text-blue-600 shrink-0" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 text-slate-700 leading-relaxed space-y-4 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-slate-900 [&_h4]:mt-6 [&_h4]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:marker:text-slate-400 [&_strong]:text-slate-900 [&_table]:text-sm">
          {children}
        </CardContent>
      </Card>
    </section>
  )
}

export default async function HandleidingPage() {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <BookOpen className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Handleiding AI-Contractbot</h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              Uitgebreide gebruikers- en beheerdersdocumentatie voor contractmanagement, AI-ondersteuning en instellingen.
              Ingelogd als <strong className="text-slate-800 font-medium">{user.name}</strong> ({ROLE_LABELS[user.role] ?? user.role}).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="font-normal">
            <Info className="h-3 w-3 mr-1" />
            Versie 1.0 · {new Date().toLocaleDateString('nl-NL', { dateStyle: 'long' })}
          </Badge>
          <Badge variant="outline" className="font-normal">
            Organisatie-context: alle gegevens zijn per organisatie afgeschermd
          </Badge>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
        <nav
          aria-label="Inhoudsopgave"
          className="lg:w-56 shrink-0 lg:sticky lg:top-8 lg:self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm h-fit"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Inhoud</p>
          <ul className="space-y-1 text-sm">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex items-center gap-1 text-slate-600 hover:text-blue-600 hover:underline py-1 rounded transition-colors"
                >
                  <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <hr className="my-4 border-slate-200" />
          <p className="text-xs text-muted-foreground">Gebruik sneltoetsen in de browser om tussen ankers te springen (hash-URL).</p>
        </nav>

        <div className="flex-1 min-w-0 space-y-10 pb-16">
          <Section id="intro" title="Inleiding: wat is AI-Contractbot?" icon={BookOpen}>
            <p>
              <strong>AI-Contractbot</strong> is een webapplicatie voor centraal contractbeheer binnen uw organisatie. U beheert
              contracten, leveranciers, documenten, verplichtingen, notificaties en goedkeuringsstromen. De applicatie combineert
              een traditionele database met <strong>AI-functies</strong> (OpenAI) voor extractie van contractgegevens, analyse,
              compliance-checks, semantisch zoeken en vergelijking van contracten.
            </p>
            <p>
              Alle contracten en gerelateerde gegevens worden opgeslagen per <strong>organisatie</strong> (<code className="text-sm bg-slate-100 px-1 rounded">orgId</code>).
              Gebruikers melden zich aan via <strong>Clerk</strong> (e-mail of andere door u geconfigureerde methoden). Uw rol bepaalt
              welke acties u mag uitvoeren (zie <a href="#rollen" className="text-blue-600 underline">Rollen en rechten</a>).
            </p>
            <h4>Kernfunctionaliteit in het kort</h4>
            <ul>
              <li>Portfolio-overzicht op het dashboard (lopende contracten, verloop, verplichtingen, meldingen).</li>
              <li>Contracten aanmaken, bewerken, archiveren en verwijderen (soft delete) met uitgebreide metadata.</li>
              <li>Documenten (PDF/DOCX) koppelen aan contracten, inclusief versiebeheer en bulkdownload.</li>
              <li>AI-ondersteunde analyse, compliance, ontwerp-review en contractvergelijking.</li>
              <li>Rapportage en export (CSV/Excel), plus optionele e-mailnotificaties via Resend en geplande jobs.</li>
            </ul>
          </Section>

          <Section id="start" title="Aan de slag" icon={Sparkles}>
            <h4>Inloggen</h4>
            <p>
              Open de applicatie-URL en meld u aan via het Clerk-inlogscherm. Na de eerste login wordt automatisch een{' '}
              <strong>gebruikersrecord</strong> en zo nodig een <strong>organisatie</strong> aangemaakt (zie <code className="text-sm bg-slate-100 px-1 rounded">getOrCreateUser</code> in de code).
              De standaardrol voor nieuwe gebruikers is vaak <strong>Lezer</strong> tenzij u in Clerk <code className="text-sm bg-slate-100 px-1 rounded">publicMetadata.role</code> anders instelt.
            </p>
            <h4>Eerste stappen na login</h4>
            <ol>
              <li>Controleer uw <strong>rol</strong> (menu Instellingen → Gebruikers, indien u beheerder bent).</li>
              <li>Voeg <strong>leveranciers</strong> toe of importeer ze via uw proces (Leveranciers).</li>
              <li>Maak een <strong>contract</strong> aan via Contracten → <Link href="/contracts/new" className="text-blue-600 underline">Nieuw contract</Link> (niet zichtbaar voor lezers).</li>
              <li>Upload <strong>documenten</strong> op het contract (tab Documenten); hiervoor is Vercel Blob geconfigureerd (zie techniek).</li>
              <li>Stel <strong>notificatieregels</strong> en <strong>aangepaste velden</strong> in onder Instellingen.</li>
            </ol>
          </Section>

          <Section id="rollen" title="Rollen en rechten" icon={Shield}>
            <p>
              De applicatie kent vijf rollen. Gegevens zijn per <strong>organisatie</strong> afgeschermd; gebruikers kunnen
              aan meerdere organisaties gekoppeld zijn en wisselen via de org-switcher rechtsboven. Contracten hangen onder
              een <strong>project</strong> binnen de actieve organisatie (zie menu Projecten).
            </p>
            <p>De labels in de UI zijn Nederlands (zie ook gebruikersbeheer).</p>
            <div className="overflow-x-auto not-prose rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 font-medium text-slate-700">Rol</th>
                    <th className="p-3 font-medium text-slate-700">Typische taken</th>
                    <th className="p-3 font-medium text-slate-700">Belangrijke beperkingen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline">{ROLE_LABELS.admin}</Badge>
                    </td>
                    <td className="p-3">Volledig beheer, gebruikersrollen wijzigen, alle contractacties.</td>
                    <td className="p-3">—</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline">{ROLE_LABELS.manager}</Badge>
                    </td>
                    <td className="p-3">Contracten beheren, goedkeuringen, rapportages, AI-tools.</td>
                    <td className="p-3">Geen gebruikersbeheer (alleen admin).</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline">{ROLE_LABELS.registrator}</Badge>
                    </td>
                    <td className="p-3">Contracten registreren en bijwerken, documenten uploaden.</td>
                    <td className="p-3">Pagina Gebruikers alleen voor admin.</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline">{ROLE_LABELS.compliance}</Badge>
                    </td>
                    <td className="p-3">
                      Inzien van (ook gearchiveerde) contracten, rapportages, bulkdownload van documenten, compliance-AI en
                      audit-export waar beschikbaar.
                    </td>
                    <td className="p-3">Geen wijzigingen aan contracten, leveranciers, verplichtingen of uploads.</td>
                  </tr>
                  <tr>
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline">{ROLE_LABELS.reader}</Badge>
                    </td>
                    <td className="p-3">Inzien van contracten en rapportages (waar toegestaan).</td>
                    <td className="p-3">
                      Geen nieuwe contracten, geen upload, geen API-aanmaak; <strong>gearchiveerde</strong> contracten zijn verborgen.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Technische kant: API-routes controleren rollen per endpoint (bijvoorbeeld <code className="bg-slate-100 px-1 rounded">reader</code> krijgt 403 bij POST).
              De pagina <Link href="/contracts/new" className="text-blue-600 underline">Nieuw contract</Link> vereist minimaal de rol registrator in de hiërarchie (registrator, manager en admin kunnen deze openen).
            </p>
          </Section>

          <Section id="navigatie" title="Schermen en menu-indeling" icon={FileText}>
            <h4>Navigatie (linkerzijbalk)</h4>
            <ul>
              <li>
                <strong>Dashboard</strong> — KPI’s, grafiek verlopende contracten, recente contracten, ongelezen meldingen.
              </li>
              <li>
                <strong>Contracten</strong> — Tabel met zoek- en filteropties; knop <em>Nieuw contract</em> voor niet-readers.
              </li>
              <li>
                <strong>Leveranciers</strong> — Overzicht leveranciers met koppeling naar contracten.
              </li>
              <li>
                <strong>Zoeken</strong> — Zoekactie op portfolio (klassiek of semantisch via AI).
              </li>
              <li>
                <strong>Rapportages</strong> — Statistieken, AI-samenvatting portfolio, export CSV/Excel.
              </li>
            </ul>
            <h4>AI Tools</h4>
            <ul>
              <li>
                <Link href="/contracts/compare" className="text-blue-600 underline">
                  Contractvergelijking
                </Link>{' '}
                — Twee contracten selecteren; AI genereert verschillen en risico’s.
              </li>
              <li>
                <Link href="/ai/draft" className="text-blue-600 underline">
                  Ontwerp-assistent
                </Link>{' '}
                — Upload een conceptcontract; AI geeft een score, suggesties en ontbrekende clausules.
              </li>
            </ul>
            <h4>Instellingen</h4>
            <ul>
              <li>
                <strong>Gebruikers</strong> — Alleen admin: rollen aanpassen.
              </li>
              <li>
                <strong>Notificaties</strong> — Overzicht regels gekoppeld aan contracten.
              </li>
              <li>
                <strong>Aangepaste velden</strong> — Extra metadatavelden voor contracten.
              </li>
              <li>
                <strong>Bewaartermijnen</strong> — Contracten met vernietigingsdatum op basis van retentie.
              </li>
            </ul>
            <p>
              Deze handleiding staat onder <Link href="/handleiding" className="text-blue-600 underline">/handleiding</Link> en is ook via het menu bereikbaar (zie sidebar).
            </p>
          </Section>

          <Section id="dashboard" title="Dashboard" icon={Sparkles}>
            <p>
              Het dashboard aggregeert gegevens voor uw organisatie: aantal <strong>actieve</strong> contracten, aantal dat binnen
              30 of 90 dagen verloopt, openstaande <strong>verplichtingen</strong>, <strong>openstaande goedkeuringen</strong>, en de
              laatst bijgewerkte contracten. Er is een <strong>grafiek</strong> (bijv. verloop per maand) en een lijst met{' '}
              <strong>dashboardmeldingen</strong> (waarschuwingen/info).
            </p>
            <p>
              Vanuit tegels en lijsten kunt u doorklikken naar individuele contracten. Meldingen kunnen worden gebruikt om aandacht
              te vragen voor verloop, compliance of acties (afhankelijk van hoe uw organisatie ze vult).
            </p>
          </Section>

          <Section id="contracten" title="Contracten (lijst en aanmaken)" icon={FileText}>
            <h4>Lijstweergave</h4>
            <p>
              De tabel toont o.a. naam, nummer, leverancier, type, status, afloopdatum, jaarwaarde en eigenaar. Gebruik de zoekbalk
              en filters (status, type) om te verfijnen. Readers zien geen <strong>gearchiveerde</strong> contracten in de lijstfilter-logica.
            </p>
            <h4>Nieuw contract</h4>
            <p>
              Niet-readers zien de knop <strong>Nieuw contract</strong>. Het formulier ondersteunt handmatige invoer en optioneel{' '}
              <strong>AI-extractie</strong>: upload een PDF/DOCX om velden te laten vullen via{' '}
              <code className="text-sm bg-slate-100 px-1 rounded">/api/ai/extract</code> (alleen parsing + AI, geen permanente opslag van het bestand).
              Na opslag wordt u doorgestuurd naar de contractdetailpagina.
            </p>
            <h4>Statussen</h4>
            <p>Contracten kennen o.a. de volgende statuslabels in de UI:</p>
            <ul className="not-prose flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Badge key={key} variant="outline">
                  {label}
                </Badge>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Verwijderen in de applicatie is doorgaans een <strong>soft delete</strong> (status “verwijderd”) zodat gegevens uit rapportages gefilterd kunnen worden.
            </p>
          </Section>

          <Section id="detail" title="Contractdetail (tabbladen)" icon={FileText}>
            <p>Op elke contractpagina vindt u de volgende tabbladen:</p>
            <ul>
              <li>
                <strong>Overzicht</strong> — Kerngegevens, acties zoals bewerken, archiveren, verwijderen (rechten afhankelijk).
              </li>
              <li>
                <strong>Documenten</strong> — Upload (PDF/DOCX), download, versiehistorie, bulk ZIP voor gemachtigde rollen. Upload gebruikt Vercel Blob.
              </li>
              <li>
                <strong>AI Analyse</strong> — Analyse op basis van het huidige document en contractcontext (vereist OpenAI en document).
              </li>
              <li>
                <strong>Compliance</strong> — AI-compliance check tegen contract en regels.
              </li>
              <li>
                <strong>Verplichtingen</strong> — Taken/verplichtingen met categorie (o.a. IT, privacy, financieel), status en deadlines.
              </li>
              <li>
                <strong>Notificaties</strong> — Regels (bijv. dagen voor afloop/optie) en ontvangers.
              </li>
              <li>
                <strong>Goedkeuring</strong> — Workflow voor nieuw contract, verlenging of wijziging (stappen, status).
              </li>
              <li>
                <strong>Toegang</strong> — Wie mag dit contract inzien of beheren (contracttoegang binnen de organisatie).
              </li>
              <li>
                <strong>Audit</strong> — Log van relevante acties (aanmaken, wijzigen, document, rol, enz.).
              </li>
            </ul>
          </Section>

          <Section id="documenten" title="Documenten en bestandsopslag" icon={Database}>
            <p>
              Contractdocumenten worden opgeslagen als records gekoppeld aan het contract, met bestandsnaam, type, grootte, versie en
              optioneel <strong>AI-verwerkingsstatus</strong> en geëxtraheerde JSON.
            </p>
            <h4>Vercel Blob</h4>
            <p>
              Bij upload naar de applicatie wordt het bestand naar <strong>Vercel Blob</strong> geüpload (publieke URL voor download).
              Zet in uw omgeving <code className="text-sm bg-slate-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code>. Zonder deze token
              mislukken uploads in omgevingen waar Blob niet is geconfigureerd.
            </p>
            <h4>Versies</h4>
            <p>
              Een nieuwe upload voor hetzelfde contract kan eerdere versies naar de geschiedenis verplaatsen (niet-huidige versies)
              volgens de upload-API. U kunt oudere versies downloaden en in aanmerking komende rollen een versie herstellen.
            </p>
          </Section>

          <Section id="leveranciers" title="Leveranciers" icon={FileText}>
            <p>
              Leveranciers zijn een aparte entiteit met o.a. naam, KvK en contactgegevens. Contracten verwijzen naar een leverancier
              zodat rapportages per leverancier en leverancierspagina’s met gekoppelde contracten mogelijk zijn. Beheer uw
              leveranciersbestand voordat u grote hoeveelheden contracten importeert.
            </p>
          </Section>

          <Section id="zoeken" title="Zoeken" icon={Sparkles}>
            <p>
              Op de zoekpagina kunt u op tekst zoeken. Zonder “semantisch” wordt een <strong>API-filter</strong> op titel/nummer gebruikt
              (klassiek). Met <strong>semantisch zoeken</strong> wordt een AI/vector-achtige zoek-API aangeroepen (
              <code className="text-sm bg-slate-100 px-1 rounded">/api/ai/search</code>) — geschikt voor natuurlijke taal, afhankelijk van
              database-inhoud en embeddings.
            </p>
          </Section>

          <Section id="rapportages" title="Rapportages en export" icon={FileText}>
            <p>
              Rapportages tonen verdeling per status en type, totale jaarwaarde, en verlopende contracten. U kunt gegevens exporteren
              als <strong>CSV</strong> of <strong>Excel</strong> via de exportknoppen. Er is een <strong>AI portfolio-samenvatting</strong> voor
              bestuurlijke teksten (vereist OpenAI).
            </p>
          </Section>

          <Section id="ai" title="AI-functies (overzicht)" icon={Sparkles}>
            <ul>
              <li>
                <strong>Extractie bij nieuw contract</strong> — PDF/DOCX → tekst → gestructureerde velden (OpenAI).
              </li>
              <li>
                <strong>Analyse & compliance</strong> — Vanuit contractdetail, gekoppeld aan huidig document.
              </li>
              <li>
                <strong>Semantisch zoeken</strong> — Zoekpagina, POST naar AI-search endpoint.
              </li>
              <li>
                <strong>Contractvergelijking</strong> — Twee contracten kiezen; verschillen en samenvatting.
              </li>
              <li>
                <strong>Ontwerp-assistent</strong> — Review van een geüpload concept met score en suggesties.
              </li>
              <li>
                <strong>Notificaties genereren</strong> — Optioneel AI-ondersteund (indien gebruikt in uw deployment).
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Alle AI-functies vereisen een geldige <code className="bg-slate-100 px-1 rounded">OPENAI_API_KEY</code> en vallen onder het
              dataprivacybeleid van uw organisatie en OpenAI. Controleer of contractteksten naar externe modellen mogen.
            </p>
          </Section>

          <Section id="instellingen" title="Instellingen" icon={Settings}>
            <ul>
              <li>
                <strong>Gebruikers</strong> — Alleen admin: rollen wijzigen voor gebruikers in dezelfde organisatie.
              </li>
              <li>
                <strong>Notificaties</strong> — Overzicht van regels per contract (triggers, ontvangers, kanalen).
              </li>
              <li>
                <strong>Aangepaste velden</strong> — Definities (tekst, selectie, datum, nummer) die in contractformulieren gebruikt worden.
              </li>
              <li>
                <strong>Bewaartermijnen</strong> — Inzicht in vernietigingsdata gebaseerd op contract-einde en retentiejaren.
              </li>
            </ul>
          </Section>

          <Section id="techniek" title="Techniek, omgeving en integraties" icon={Database}>
            <p>De applicatie is gebouwd met Next.js (App Router), Drizzle ORM, Neon PostgreSQL en Clerk. Relevante omgevingsvariabelen:</p>
            <div className="overflow-x-auto not-prose rounded-lg border border-slate-200 text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-3 text-left font-medium text-slate-700">Variabele</th>
                    <th className="p-3 text-left font-medium text-slate-700">Doel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-mono text-xs">DATABASE_URL</td>
                    <td className="p-3">PostgreSQL (bijv. Neon) — verplicht voor alle data.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">OPENAI_API_KEY</td>
                    <td className="p-3">OpenAI API — voor extractie, analyse, zoeken, vergelijking, ontwerp-assistent.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">BLOB_READ_WRITE_TOKEN</td>
                    <td className="p-3">Vercel Blob — documentuploads en download-URL’s.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">NEXT_PUBLIC_APP_URL</td>
                    <td className="p-3">Basis-URL van de app (o.a. links in e-mails van notificaties).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">RESEND_API_KEY</td>
                    <td className="p-3">Resend — verzenden van e-mails vanuit notificatieverwerking.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">CRON_SECRET</td>
                    <td className="p-3">Geheime bearer voor het aanroepen van geplande routes (bijv. notificatieverwerking).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">Clerk (*)</td>
                    <td className="p-3">
                      Standaard Clerk-variabelen (<code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>,{' '}
                      <code className="bg-slate-100 px-1 rounded">CLERK_SECRET_KEY</code>, enz.) — zie Clerk-documentatie.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Testdata kan lokaal worden geladen met <code className="bg-slate-100 px-1 rounded">npm run db:seed</code> (script{' '}
              <code className="bg-slate-100 px-1 rounded">scripts/seed.ts</code>), afhankelijk van een werkende{' '}
              <code className="bg-slate-100 px-1 rounded">DATABASE_URL</code>.
            </p>
          </Section>

          <Section id="faq" title="Tips en veelgestelde vragen" icon={Info}>
            <h4>Ik zie geen knop “Nieuw contract”</h4>
            <p>
              Controleer uw rol. Alleen gebruikers met meer rechten dan <strong>Lezer</strong> zien de knop. Vraag een beheerder om uw rol
              te verhogen in het gebruikersbeheer of via Clerk metadata.
            </p>
            <h4>Upload mislukt</h4>
            <p>
              Controleer <code className="text-sm bg-slate-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code> en of de omgeving internettoegang heeft naar Vercel Blob.
              Controleer ook bestandstype (PDF/DOCX) en maximale grootte volgens uw hostinglimiet.
            </p>
            <h4>AI geeft geen resultaat</h4>
            <p>
              Controleer <code className="text-sm bg-slate-100 px-1 rounded">OPENAI_API_KEY</code>, quota en of het document leesbare tekst bevat (gescande PDF’s zonder OCR kunnen problemen geven).
            </p>
            <h4>Gegevens van seed vs. productie</h4>
            <p>
              Seed-scripts zijn bedoeld voor demo/test; gebruik ze niet onbedoeld op productie zonder beleid voor anonieme/testdata.
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Externe documentatie: Clerk, Vercel Blob, OpenAI en Neon hebben eigen privacy- en beveiligingspagina’s.
            </p>
          </Section>

          <Card className="bg-blue-50/80 border-blue-100">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-slate-700">
                Suggesties voor deze handleiding? Neem contact op met uw applicatiebeheerder of pas de pagina{' '}
                <code className="text-xs bg-white/80 px-1 rounded border">app/(dashboard)/handleiding/page.tsx</code> aan.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 shrink-0"
              >
                Terug naar dashboard
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
