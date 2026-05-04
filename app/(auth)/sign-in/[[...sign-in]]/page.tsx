import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10">
      <p className="mb-4 max-w-md text-center text-xs text-zinc-600">
        Alleen uitgenodigde gebruikers kunnen inloggen. Geen account? Neem contact op met uw beheerder.
      </p>
      <div className="text-center">
        <SignIn
          appearance={{
            elements: {
              footerAction: 'hidden',
            },
          }}
        />
      </div>
    </div>
  )
}
