/**
 * 自動投稿の設定の受け取り方（PUT /api/marketing/autopilot の入力の検証）。
 *
 * zod の object は、ここに書いていない項目を黙って捨てる。
 * そのため AutopilotSettings に項目を足したら、必ずここにも足すこと
 * （2026-11-23：求人ストーリーの項目をここに足し忘れ、画面で保存しても設定が戻る不具合になった）。
 * 足し忘れは `npx tsx tools/marketing/test-autopilot-settings-schema.mjs` が知らせる。
 */
import { z } from 'zod'

export const SettingsSchema = z.object({
  enabled: z.boolean(),
  postsPerWeek: z.number().int().min(1).max(5),
  slots: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }))
    .min(1)
    .max(5),
  instagram: z.enum(['instagram_feed', 'instagram_carousel', 'off']),
  google: z.boolean(),
  availabilityPost: z.boolean(),
  googleSeo: z.boolean().default(true),
  googleSeoPerWeek: z.number().int().min(1).max(2).default(2),
  youtubeShorts: z.boolean().default(true),
  tiktokVideo: z.boolean().default(true),
  instagramReels: z.boolean().default(true),
  promoVideoPerWeek: z.number().int().min(1).max(2).default(1),
  youtubeAudited: z.boolean().default(false),
  availabilityStory: z.boolean().default(true),
  cancelStory: z.boolean().default(false),
  cancelStoryDays: z.enum(['today', 'tomorrow']).default('tomorrow'),
  cancelStoryLeadMinutes: z.number().int().min(0).max(360).default(60),
  cancelStoryFromHour: z.number().int().min(0).max(23).default(7),
  cancelStoryToHour: z.number().int().min(1).max(24).default(21),
  cancelStoryMaxPerDay: z.number().int().min(1).max(10).default(3),
  dailyOpenings: z.boolean().default(true),
  dailyOpeningsTimes: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
    .max(3)
    .default(['08:00', '13:00']),
  dailyOpeningsStory: z.boolean().default(true),
  dailyOpeningsGoogle: z.boolean().default(true),
  // 求人ストーリー（2026-11-23）。ここに足し忘れると、zod が黙って捨てるので設定が保存されない
  recruitStory: z.boolean().default(false),
  recruitStoryTimes: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
    .max(4)
    .default(['09:00', '14:00', '19:00']),
  recruitStoryVideoUrl: z.string().max(2000).default(''),
  recruitStoryUntil: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, '掲載の終わりの日は YYYY-MM-DD で入れてください')
    .default(''),
  generateHour: z.number().int().min(6).max(22),
  ownerNote: z.string().max(400),
  clinicProfile: z.record(z.string(), z.string().max(2000)).optional(),
})

