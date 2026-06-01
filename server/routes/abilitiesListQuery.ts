export function buildAbilitiesListQuery(
  warframe: string | undefined,
  abilityNames: string[],
): { whereSql: string; params: unknown[] } | null {
  if (abilityNames.length > 0) {
    return {
      whereSql: `unique_name IN (${abilityNames.map(() => '?').join(',')})`,
      params: [...abilityNames],
    };
  }
  if (warframe) {
    return { whereSql: 'warframe_unique_name = ?', params: [warframe] };
  }
  return null;
}
