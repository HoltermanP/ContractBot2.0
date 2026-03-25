/** Hoofdcontract heeft voorkeur voor getoonde AI-extractie; anders elk actueel document met extractie. */
export function pickDocumentWithAiExtract(documents: any[] | undefined): any {
  const current = documents?.filter((d) => d.isCurrent) ?? []
  return (
    current.find((d) => d.documentKind !== 'addendum' && d.aiExtractedDataJson) ??
    current.find((d) => d.aiExtractedDataJson)
  )
}
