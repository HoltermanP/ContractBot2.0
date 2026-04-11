/** Addendum > extra contractstuk > hoofdcontract voor getoonde AI-extractie. */
export function pickDocumentWithAiExtract(documents: any[] | undefined): any {
  const current = documents?.filter((d) => d.isCurrent) ?? []
  const sortedCurrent = [...current].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )
  return (
    sortedCurrent.find((d) => d.documentKind === 'addendum' && d.aiExtractedDataJson) ??
    sortedCurrent.find((d) => d.documentKind === 'contractstuk' && d.aiExtractedDataJson) ??
    sortedCurrent.find((d) => d.documentKind === 'hoofdcontract' && d.aiExtractedDataJson)
  )
}
