export async function parseDocument(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    return data.text
  }

  if (mimeType.includes('wordprocessingml') || mimeType.includes('docx') || mimeType.includes('openxmlformats')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  throw new Error('Niet-ondersteund bestandstype. Alleen PDF en DOCX zijn toegestaan.')
}
