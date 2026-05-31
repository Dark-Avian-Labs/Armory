export const PIPELINE_STEPS = [
  {
    key: 'schema',
    label: 'Schema',
    description: 'Create or migrate SQLite tables.',
  },
  {
    key: 'officialExports',
    label: 'Exports',
    description: 'Download DE manifest and export JSON files.',
  },
  {
    key: 'sqliteFromExports',
    label: 'Database',
    description: 'Rebuild game tables when export hashes change.',
  },
  {
    key: 'exaltedStanceMods',
    label: 'Exalted Stances',
    description: 'Sync exalted stance mods from Overframe; wiki images when exports are unchanged.',
  },
  {
    key: 'images',
    label: 'Images',
    description: 'Download new or changed item images.',
  },
  {
    key: 'hiddenCompanionWeapons',
    label: 'Companion Weapons',
    description: 'Sync hidden beast claw weapons from Overframe.',
  },
  {
    key: 'overframe',
    label: 'Overframe',
    description: 'Scrape artifact slots and weapon behaviors for items missing build data.',
  },
  {
    key: 'wiki',
    label: 'Wiki',
    description: 'Scrape ability stats, augments, shards, and riven dispositions.',
  },
  {
    key: 'helminthWiki',
    label: 'Helminth',
    description: 'Flag helminth-infusable abilities from the wiki.',
  },
  {
    key: 'incarnonWiki',
    label: 'Incarnon',
    description: 'Sync incarnon evolution data when weapons export changes.',
  },
  {
    key: 'warframeMarketLinks',
    label: 'Warframe Market',
    description: 'Refresh trade link index when catalog changes.',
  },
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]['key'];

export const PIPELINE_STEP_KEYS: PipelineStepKey[] = PIPELINE_STEPS.map((step) => step.key);

export function isPipelineStepKey(value: unknown): value is PipelineStepKey {
  return typeof value === 'string' && PIPELINE_STEP_KEYS.includes(value as PipelineStepKey);
}

export function parseForceSteps(value: unknown): PipelineStepKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value.filter(isPipelineStepKey);
  return steps.length > 0 ? steps : undefined;
}
