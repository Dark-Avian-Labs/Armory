import type { ImportPipelineStats } from './pipeline.js';

export type SummaryOutcome = 'ok' | 'skipped' | 'failed' | 'partial';

export interface StartupPipelineSummary {
  durationMs: number;
  schema: { outcome: SummaryOutcome; detail?: string };
  officialExports: {
    outcome: SummaryOutcome;
    error?: string;
    stats?: ImportPipelineStats;
  };
  sqliteFromExports: {
    outcome: SummaryOutcome;
    reason: string;
    rows?: {
      warframes: number;
      weapons: number;
      companions: number;
      mods: number;
      modSets: number;
      arcanes: number;
      abilities: number;
    };
    modDescriptionsBackfilled?: number;
    error?: string;
  };
  exaltedStanceMods: {
    outcome: SummaryOutcome;
    reason?: string;
    found?: number;
    insertedOrUpdated?: number;
    error?: string;
  };
  images: {
    outcome: SummaryOutcome;
    total?: number;
    downloaded?: number;
    skipped?: number;
    failed?: number;
    error?: string;
    sampleErrors?: string[];
  };
  hiddenCompanionWeapons: {
    outcome: SummaryOutcome;
    reason?: string;
    found?: number;
    insertedOrUpdated?: number;
    error?: string;
  };
  overframe: {
    outcome: SummaryOutcome;
    totalIndexed?: number;
    matchedNeedingWork?: number;
    pagesScraped?: number;
    merge?: {
      warframesUpdated: number;
      weaponsUpdated: number;
      companionsUpdated: number;
      abilitiesUpdated: number;
      helminthUpdated: number;
    };
    skipReason?: string;
    error?: string;
  };
  wiki: {
    outcome: SummaryOutcome;
    merge?: {
      abilitiesUpdated: number;
      passivesUpdated: number;
      augmentsUpdated: number;
      shardTypes: number;
      shardBuffs: number;
      rivenDispositionsSyncedFromOmega: number;
      rivenDispositionsWikiFallback: number;
      weaponsProjectileSpeedsUpdated: number;
    };
    error?: string;
    skipReason?: string;
  };
  helminthFandom: {
    outcome: SummaryOutcome;
    wikiNamesFound?: number;
    abilitiesFlagged?: number;
    fetchOk?: boolean;
    error?: string;
    skipReason?: string;
  };
  blockingIssues: string[];
}

const DIV = '══════════════════════════════════════════════════════════════';

function clipList(items: string[], max = 12): string {
  if (items.length === 0) return '—';
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} ... (+${items.length - max} more)`;
}

function outcomeLabel(o: SummaryOutcome): string {
  switch (o) {
    case 'ok':
      return 'OK';
    case 'skipped':
      return 'skipped';
    case 'failed':
      return 'failed';
    case 'partial':
      return 'partial';
    default:
      return o;
  }
}

export function printStartupPipelineSummary(s: StartupPipelineSummary): void {
  console.log(`\n${DIV}`);
  console.log(' Run summary — what ran and what changed');
  console.log(`${DIV}`);
  console.log(` Duration: ${(s.durationMs / 1000).toFixed(1)}s\n`);

  if (s.blockingIssues.length > 0) {
    console.log(' Blocking issues:');
    for (const line of s.blockingIssues) console.log(`   • ${line}`);
    console.log('');
  }

  const row = (title: string, outcome: SummaryOutcome, lines: string[]) => {
    console.log(` ${title}  [${outcomeLabel(outcome)}]`);
    for (const l of lines) console.log(`   ${l}`);
    console.log('');
  };

  row(
    'Schema',
    s.schema.outcome,
    s.schema.detail ? [s.schema.detail] : ['SQLite app schema ensured.'],
  );

  const ex = s.officialExports;
  if (ex.outcome === 'failed' && ex.error) {
    row('Official exports (manifest + files)', 'failed', [ex.error]);
  } else if (ex.stats) {
    const st = ex.stats;
    const lines: string[] = [
      `Tracked ${st.requiredCount} required export categories.`,
      `Updated on disk (new or changed hash): ${st.downloaded.length} — ${clipList(st.downloaded)}`,
      `Left unchanged (local hash matched CDN): ${st.skippedUnchanged.length}`,
    ];
    if (st.failed.length > 0) {
      lines.push(`Download failures: ${st.failed.length}`);
      for (const f of st.failed.slice(0, 5)) {
        lines.push(`  • ${f.category}: ${f.error}`);
      }
      if (st.failed.length > 5) lines.push(`  ... +${st.failed.length - 5} more`);
    }
    row('Official exports (manifest + files)', st.failed.length > 0 ? 'partial' : 'ok', lines);
  } else {
    row('Official exports (manifest + files)', ex.outcome, ['No stats recorded.']);
  }

  const db = s.sqliteFromExports;
  row('SQLite ← export JSON', db.outcome, [
    db.reason,
    ...(db.rows
      ? [
          `Counts written: ${db.rows.warframes} warframes, ${db.rows.weapons} weapons, ` +
            `${db.rows.companions} companions, ${db.rows.mods} mods, ${db.rows.modSets} mod sets, ` +
            `${db.rows.arcanes} arcanes, ${db.rows.abilities} abilities.`,
        ]
      : []),
    ...(db.modDescriptionsBackfilled !== undefined
      ? [`Mod descriptions backfilled from rank stats: ${db.modDescriptionsBackfilled}.`]
      : []),
    ...(db.error ? [`Error: ${db.error}`] : []),
  ]);

  const es = s.exaltedStanceMods;
  row('Exalted stance mods (Overframe)', es.outcome, [
    ...(es.reason ? [es.reason] : []),
    ...(es.found !== undefined
      ? [`Stances found: ${es.found}; rows inserted/updated: ${es.insertedOrUpdated ?? 0}.`]
      : []),
    ...(es.error ? [`Error: ${es.error}`] : []),
  ]);

  const im = s.images;
  const imLines: string[] = [];
  if (im.total !== undefined) {
    imLines.push(
      `Considered ${im.total} manifest textures: ${im.downloaded ?? 0} downloaded, ` +
        `${im.skipped ?? 0} already present, ${im.failed ?? 0} failed.`,
    );
  }
  if (im.error) imLines.push(`Error: ${im.error}`);
  if (im.sampleErrors && im.sampleErrors.length > 0) {
    imLines.push('Sample failures:');
    for (const e of im.sampleErrors.slice(0, 4)) imLines.push(`  • ${e}`);
  }
  if (imLines.length === 0) imLines.push('No image stats recorded.');
  row('Icon / texture downloads', im.outcome, imLines);

  const hi = s.hiddenCompanionWeapons;
  row('Hidden companion weapons (Overframe)', hi.outcome, [
    ...(hi.reason ? [hi.reason] : []),
    ...(hi.found !== undefined
      ? [`Pages resolved: ${hi.found}; rows touched: ${hi.insertedOrUpdated ?? 0}.`]
      : []),
    ...(hi.error ? [`Error: ${hi.error}`] : []),
  ]);

  const ov = s.overframe;
  const ovLines: string[] = [];
  if (ov.skipReason) ovLines.push(ov.skipReason);
  else {
    if (ov.totalIndexed !== undefined) {
      ovLines.push(
        `Index crawl: ${ov.totalIndexed} links seen; ${ov.matchedNeedingWork ?? 0} matched DB rows still missing build data.`,
      );
    }
    if (ov.pagesScraped !== undefined)
      ovLines.push(`Detail pages scraped this run: ${ov.pagesScraped}.`);
    if (ov.merge) {
      ovLines.push(
        `Merged into DB: ${ov.merge.warframesUpdated} warframes, ${ov.merge.weaponsUpdated} weapons, ` +
          `${ov.merge.companionsUpdated} companions, ${ov.merge.abilitiesUpdated} abilities, ` +
          `${ov.merge.helminthUpdated} helminth flags.`,
      );
    }
  }
  if (ov.error) ovLines.push(`Error: ${ov.error}`);
  if (ovLines.length === 0) ovLines.push('No Overframe stats recorded.');
  row('Overframe.gg (builds / artifacts)', ov.outcome, ovLines);

  const wk = s.wiki;
  const wkLines: string[] = [];
  if (wk.merge) {
    wkLines.push(
      `Wiki-driven DB updates: ${wk.merge.abilitiesUpdated} ability stat rows, ${wk.merge.passivesUpdated} passives, ` +
        `${wk.merge.augmentsUpdated} augment links, ${wk.merge.shardTypes} shard types, ${wk.merge.shardBuffs} shard buffs, ` +
        `${wk.merge.rivenDispositionsSyncedFromOmega} riven dispositions from omega, ${wk.merge.rivenDispositionsWikiFallback} wiki disposition fallbacks, ` +
        `${wk.merge.weaponsProjectileSpeedsUpdated} weapon projectile speed injections.`,
    );
  }
  if (wk.error) wkLines.push(`Error: ${wk.error}`);
  if (wkLines.length === 0) {
    if (wk.outcome === 'skipped' && wk.skipReason) wkLines.push(wk.skipReason);
    else wkLines.push('No wiki stats recorded.');
  }
  row('Warframe Wiki enrichment', wk.outcome, wkLines);

  const hm = s.helminthFandom;
  const hmLines: string[] = [];
  if (hm.skipReason) hmLines.push(hm.skipReason);
  if (hm.wikiNamesFound !== undefined) {
    hmLines.push(
      `Fandom page tokens: ${hm.wikiNamesFound}; abilities flagged this run: ${hm.abilitiesFlagged ?? 0}.`,
    );
  }
  if (hm.error) hmLines.push(`Error: ${hm.error}`);
  if (hmLines.length === 0) hmLines.push('No Helminth Fandom stats recorded.');
  row('Helminth (Fandom)', hm.outcome, hmLines);

  console.log(`${DIV}\n`);
}
