import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

/**
 * Uitnodiging voltooien: alleen zinvol met de link uit de uitnodigingsmail (Clerk verwerkt de token in de URL).
 * Openbare zelfregistratie staat in Clerk uit; bezoekers zonder geldige uitnodiging kunnen geen account aanmaken.
 *
 * Tip (Clerk Dashboard): zet aanmelden op «alleen uitnodiging» en gebruik bij voorkeur «e-mailcode» i.p.v. wachtwoord
 * voor een kortere flow (je krijgt dan een code per mail, geen «nieuw wachtwoord bedenken»).
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10">
      <div className="mb-4 max-w-md text-center text-xs text-zinc-600 space-y-2">
        <p>
          Heeft u een uitnodiging per mail? Open die link op dit apparaat en voltooi hieronder de activatie. Daarna gaat u
          automatisch naar het dashboard.
        </p>
        <p>
          Al een account?{' '}
          <Link href="/sign-in" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">
            Inloggen
          </Link>
        </p>
      </div>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            footerAction: 'hidden',
          },
        }}
      />
    </div>
  )
}
