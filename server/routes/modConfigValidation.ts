import { z } from 'zod';

import { isAllowedEquipmentImage } from '../http/allowedFetchHosts.js';
import {
  appendModConfigSizeIssues,
  MAX_ARCANE_SLOTS,
  MAX_MOD_CONFIG_SLOTS,
  MAX_SHARD_SLOTS,
} from './modConfigLimits.js';

export const MAX_MOD_CONFIG_NAME_LENGTH = 255;
export const MAX_EQUIPMENT_UNIQUE_NAME_LENGTH = 512;
export const MAX_EQUIPMENT_IMAGE_LENGTH = 2048;

const RivenStatSchema = z.object({
  stat: z.string().trim(),
  value: z.number().finite(),
  isNegative: z.boolean(),
});

export const RivenConfigSchema = z
  .object({
    polarity: z.enum(['AP_ATTACK', 'AP_TACTIC', 'AP_DEFENSE']).optional(),
    positive: z.array(RivenStatSchema),
    negative: RivenStatSchema.optional(),
  })
  .superRefine((config, ctx) => {
    for (const [index, stat] of config.positive.entries()) {
      if (stat.isNegative) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Positive Riven stats must have isNegative=false',
          path: ['positive', index, 'isNegative'],
        });
      }
    }
    if (config.negative && !config.negative.isNegative) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Negative Riven stat must have isNegative=true',
        path: ['negative', 'isNegative'],
      });
    }
  });

export const EquipmentTypeSchema = z.enum([
  'warframe',
  'primary',
  'secondary',
  'melee',
  'archgun',
  'archmelee',
  'companion',
  'beast_claws',
  'archwing',
  'necramech',
  'kdrive',
  'tektolyst',
]);

export const LoadoutSlotTypeSchema = z.enum([
  'warframe',
  'primary',
  'secondary',
  'melee',
  'companion',
  'companion_weapon',
  'archwing',
  'archgun',
  'archmelee',
  'beast_claws',
  'necramech',
  'kdrive',
  'tektolyst',
  'special_primary',
  'special_secondary',
  'special_melee',
]);

export const EquipmentImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_EQUIPMENT_IMAGE_LENGTH)
  .refine(isAllowedEquipmentImage, {
    message: 'equipment_image must be a same-origin relative path or an allowlisted HTTPS URL',
  });

export const ModSlotSchema = z
  .object({
    index: z.number().int().min(0),
    type: z.enum(['general', 'aura', 'stance', 'exilus', 'posture']),
    polarity: z.string().trim().min(1).optional(),
    mod: z.record(z.string(), z.unknown()).optional(),
    rank: z.number().int().min(0).optional(),
    setRank: z.number().int().min(0).optional(),
    riven_art_path: z.string().trim().min(1).optional(),
    riven_config: RivenConfigSchema.optional(),
  })
  .strict();

export const ModConfigSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).max(MAX_MOD_CONFIG_NAME_LENGTH),
    equipment_type: EquipmentTypeSchema,
    equipment_unique_name: z.string().trim().min(1).max(MAX_EQUIPMENT_UNIQUE_NAME_LENGTH),
    slots: z.array(ModSlotSchema),
    helminth: z
      .union([
        z
          .object({
            replaced_ability_index: z.number().int().min(0),
            replacement_ability_unique_name: z.string().trim().min(1),
          })
          .strict(),
        z
          .object({
            replaced_ability_key: z.string().trim().min(1),
            replacement_ability_key: z.string().trim().min(1),
          })
          .strict(),
      ])
      .optional(),
    arcaneSlots: z
      .array(
        z.object({
          arcane: z
            .object({
              unique_name: z.string().trim().min(1),
              name: z.string().trim().min(1),
              rarity: z.string().trim().min(1).optional(),
              image_path: z.string().trim().min(1).optional(),
              level_stats: z.string().trim().min(1).optional(),
            })
            .optional(),
          rank: z.number().int().min(0),
        }),
      )
      .optional(),
    shardSlots: z
      .array(
        z.union([
          z
            .object({
              shard_type_id: z.coerce.string().trim().min(1).optional(),
              buff_id: z.coerce.number().int().positive().optional(),
              tauforged: z.boolean(),
            })
            .strict(),
          z.object({ armory_shard_key: z.string().trim().min(1) }).strict(),
        ]),
      )
      .optional(),
    orokinReactor: z.boolean().optional(),
    incarnonEnabled: z.boolean().optional(),
    incarnonSelections: z
      .array(
        z.object({
          tier: z.number().int().min(1),
          perkName: z.string().nullable(),
          unlocked: z.boolean(),
        }),
      )
      .optional(),
    valenceBonus: z
      .object({
        element: z.enum([
          'Impact',
          'Heat',
          'Cold',
          'Electricity',
          'Toxin',
          'Magnetic',
          'Radiation',
        ]),
        percent: z.number().min(0).max(100),
      })
      .nullable()
      .optional(),
    equipment_name: z.string().trim().min(1).optional(),
    equipment_image: EquipmentImageSchema.optional(),
    note: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.slots.length > MAX_MOD_CONFIG_SLOTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `slots must contain at most ${MAX_MOD_CONFIG_SLOTS} entries`,
        path: ['slots'],
      });
    }
    if (config.arcaneSlots && config.arcaneSlots.length > MAX_ARCANE_SLOTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `arcaneSlots must contain at most ${MAX_ARCANE_SLOTS} entries`,
        path: ['arcaneSlots'],
      });
    }
    if (config.shardSlots && config.shardSlots.length > MAX_SHARD_SLOTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `shardSlots must contain at most ${MAX_SHARD_SLOTS} entries`,
        path: ['shardSlots'],
      });
    }
    appendModConfigSizeIssues(config, ctx);
  });

export function minimalModConfig(
  overrides: Partial<z.infer<typeof ModConfigSchema>> = {},
): z.infer<typeof ModConfigSchema> {
  return {
    name: 'Test Build',
    equipment_type: 'warframe',
    equipment_unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
    slots: [],
    ...overrides,
  };
}
