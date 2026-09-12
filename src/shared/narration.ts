import { z } from 'zod'
import { ROLES, TONES } from '../engine/types.js'
import { VERDICTS } from '../engine/verdict.js'

/**
 * The contract between the game and the narrator.
 *
 * Lives outside src/app and outside api/ because both compile it: the browser
 * builds the request, the serverless function validates it. One definition
 * means the two cannot drift into disagreeing about the same JSON.
 */
/**
 * A short line of the story. Beats are revealed one at a time.
 *
 * The beat is shown beside the speaker's photograph, at reading size, one at a
 * time: a caption, not a paragraph. The prompt asks for 190 characters, about
 * two sentences, and this cap is deliberately looser than that.
 *
 * The cap used to be 400 - four sentences - and a schema that permits
 * something is the instruction that wins, so the screen filled with prose.
 * But the two numbers cannot be the same one. This schema is what
 * messages.parse validates against, and a single beat one character over
 * throws away the entire judgement: the run drops to the templated fallback
 * after the call has already been paid for, which is the flat story this
 * change exists to stop. String length is not reliably enforced by structured
 * output, so the prompt carries the brief and the schema only catches prose
 * that has genuinely run away.
 */
export const beatSchema = z.object({
  tone: z.enum(TONES),
  /** The post whose holder this beat is about, or null for the room at large. */
  role: z.enum(ROLES).nullable(),
  text: z.string().min(1).max(260),
})
export type NarrationBeat = z.infer<typeof beatSchema>

/** How one post handled what the crisis asked of it, and why. */
export const roleVerdictSchema = z.object({
  role: z.enum(ROLES),
  verdict: z.enum(VERDICTS),
  reason: z.string().min(1).max(300),
})

export const narrationSchema = z.object({
  /** Exactly one judgement per post, whether or not the crisis tested it. */
  verdicts: z.array(roleVerdictSchema).length(ROLES.length),
  beats: z.array(beatSchema).min(4).max(12),
})
export type Narration = z.infer<typeof narrationSchema>

/**
 * What the narrator is told. Deliberately small and fully described - the
 * model gets who these people were and how each check went, and nothing about
 * the scoring maths, which is not something a story should recite.
 */
export const appointmentSchema = z.object({
  role: z.enum(ROLES),
  name: z.string().max(80),
  office: z.string().max(120),
  era: z.string().max(40),
  bio: z.string().max(400),
  traits: z.array(z.string().max(40)).max(8),
  category: z.enum(['politician', 'wildcard', 'object']),
  /** What the crisis asked of this post. Empty when it asked nothing. */
  demands: z.array(z.object({
    quality: z.string().max(20),
    /** True when the crisis punishes the quality rather than rewarding it. */
    invert: z.boolean(),
    isTwist: z.boolean(),
    note: z.string().max(200).optional(),
  })).max(4),
})

export const narrationRequestSchema = z.object({
  event: z.object({
    title: z.string().max(120),
    year: z.number().int(),
    dossier: z.string().max(600),
    twist: z.string().max(400),
  }),
  cabinet: z.array(appointmentSchema).length(ROLES.length),
  chemistry: z.array(z.object({ text: z.string().max(300), good: z.boolean() })).max(8),
  coup: z.object({ usurperRole: z.enum(ROLES), usurperName: z.string().max(80), presidentName: z.string().max(80) }).nullable(),
  /** No tier is supplied any more: the verdicts decide it. */
})
export type NarrationRequest = z.infer<typeof narrationRequestSchema>
