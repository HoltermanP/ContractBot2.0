import Link from 'next/link'

/**
 * Openbare registratie staat uit. Accounts worden alleen door een beheerder aangemaakt (Clerk-uitnodiging).
 * Zelfstandig aanmelden via deze app is niet mogelijk.
 */
export default function SignUpDisabledPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Geen open registratie</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Uw organisatie gebruikt alleen accounts die door een beheerder worden uitgenodigd. Heeft u een uitnodiging
          ontvangen? Gebruik dan de link in die e-mail om uw account te activeren. Daarna kunt u hier inloggen.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Naar inloggen
        </Link>
      </div>
    </div>
  )
}
