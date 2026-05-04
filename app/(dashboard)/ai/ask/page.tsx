import { Suspense } from 'react'
import ContractAskClient from './contract-ask-client'

export default function ContractAskPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[40vh] w-full max-w-[1400px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50/80 px-6 py-16 text-sm text-zinc-500">
          Bezig met laden…
        </div>
      }
    >
      <ContractAskClient />
    </Suspense>
  )
}
