import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { parseDocument } from '@/lib/parse-document'
import { openai } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const contractType = formData.get('contractType') as string ?? ''
    const context = formData.get('context') as string ?? ''

    if (!file) return NextResponse.json({ error: 'Geen bestand opgegeven' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await parseDocument(buffer, file.type)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      user: `org_${user.orgId}`,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Je bent een expert contractjurist. Analyseer het opgegeven contractconcept en geef concrete verbeteringsuggesties.
Antwoord ALLEEN in het Nederlands als JSON:
{
  "overallScore": number (0-100, hogere score = betere kwaliteit),
  "summary": string,
  "suggestions": [
    {
      "category": "juridisch"|"financieel"|"risico"|"volledigheid"|"formulering",
      "priority": "hoog"|"middel"|"laag",
      "title": string,
      "description": string,
      "suggestedText": string|null
    }
  ],
  "missingClauses": [string],
  "positiveAspects": [string]
}`,
        },
        {
          role: 'user',
          content: `Analyseer dit contractconcept${contractType ? ` (type: ${contractType})` : ''}${context ? `\nContext: ${context}` : ''}:\n\n${text.slice(0, 30000)}`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Geen respons van AI')
    return NextResponse.json(JSON.parse(content))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
