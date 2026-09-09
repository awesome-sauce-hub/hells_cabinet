import { z } from 'zod'
import { ROLES, TONES } from '../engine/types.js'

/**
 * The contract between the game and the narrator.
 *
 * Lives outside src/app and outside api/ because both compile it: the browser
 * builds the request, the serverless function validates it. One definition
 * means the two cannot drift into disagreeing about the same JSON.
 */
/** A short line of the story. Beats are revealed one at a time. */
export const beatSchema = z.object({
  tone: z.enum(TONES),
  /** The post whose holder this beat is about, or null for the room at large. */
  role: z.enum(ROLES).nullable(),
  text: z.string().min(1).max(400),
})
export type NarrationBeat = z.infer<typeof beatSchema>

export const narrationSchema = z.object({
  beats: z.array(beatSchema).min(4).max(14),
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
  /** How the event's checks on this person went. */
  outcomes: z.array(z.object({
    passed: z.boolean(),
    stat: z.string().max(20),
    isTwist: z.boolean(),
    /** How decisively, so the prose can tell a near miss from a rout. */
    margin: z.enum(['disaster', 'narrow-fail', 'narrow-pass', 'triumph']),
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
  tier: z.string().max(40),
})
export type NarrationRequest = z.infer<typeof narrationRequestSchema>

export type MarginBand = NarrationRequest['cabinet'][number]['outcomes'][number]['margin']
