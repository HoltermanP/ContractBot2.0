import { openai } from '@/lib/openai'

export type QuizQuestion = {
  question: string
  options: string[]
  correctIndex: number
}

export type GeneratedModule = {
  title: string
  bodyMarkdown: string
  estimatedMinutes: number
  quiz?: QuizQuestion[]
}

export type GeneratedCourse = {
  introduction: string
  modules: GeneratedModule[]
}

export async function generateExtendedContractTraining(
  sourceBlocks: { label: string; text: string }[],
  orgId: string
): Promise<GeneratedCourse> {
  const parts = sourceBlocks.map((b, i) => `--- Bron ${i + 1}: ${b.label} ---\n${b.text}`)
  const joined = parts.join('\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    user: `org_${orgId}`,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Je bent een senior expert in contracten en didactiek. Maak een uitgebreide e-learningtraining voor professionals op basis van de aangeleverde contractdocumenten (inclusief addenda/bijlagen als die in de tekst zitten).

Eisen:
- Taal: Nederlands.
- Maak 5 tot 10 modules met diepgaande uitleg: definities, praktijkvoorbeelden, aandachtspunten, risico's, en wat de deelnemer moet onthouden.
- Gebruik alleen informatie die in de bronnen staat of redelijke algemene juridische context die niet in tegenspraak is met de tekst. Geen verzonnen clausules.
- bodyMarkdown: gebruik Markdown (kopjes ##, lijsten, vet waar nuttig).
- Per module: 2 tot 4 meerkeujsvragen over de stof (quiz), tenzij er te weinig basis is — dan lege quiz array.
- estimatedMinutes: realistische leestijd per module (5–25 min).

JSON-schema:
{
  "introduction": string (korte alinea voor de cursuspagina),
  "modules": [
    {
      "title": string,
      "bodyMarkdown": string,
      "estimatedMinutes": number,
      "quiz": [
        {
          "question": string,
          "options": string[] (4 antwoorden),
          "correctIndex": number (0-3)
        }
      ]
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Contractbronnen voor de training:\n\n${joined.slice(0, 120_000)}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Geen respons van OpenAI')
  const parsed = JSON.parse(content) as GeneratedCourse
  if (!parsed.modules?.length) throw new Error('Geen modules gegenereerd')
  return parsed
}

export function buildGammaInputFromCourse(courseTitle: string, introduction: string, modules: { title: string; bodyMarkdown: string }[]): string {
  const lines: string[] = [
    `# Training: ${courseTitle}`,
    '',
    introduction,
    '',
    ...modules.flatMap((m) => [`## ${m.title}`, '', m.bodyMarkdown, '']),
  ]
  return lines.join('\n').slice(0, 95_000)
}
