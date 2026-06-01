import path from 'path';

import Database from 'better-sqlite3';

const dbPath = path.resolve(process.argv[2] ?? 'data/armory.db');
const db = new Database(dbPath, { readonly: true });

const builds = db
  .prepare(
    `SELECT id, name, equipment_unique_name, mod_config, helminth_config
     FROM builds WHERE name LIKE '%Titania%' OR name LIKE '%AoE%'`,
  )
  .all();

console.log('Builds:', JSON.stringify(builds, null, 2));

for (const b of builds) {
  let mod = null;
  try {
    mod = JSON.parse(b.mod_config);
  } catch {
    // ignore
  }
  console.log('\nmod_config.helminth:', mod?.helminth);
  console.log('helminth_config column:', b.helminth_config);
}

const frames = db
  .prepare(`SELECT unique_name, name, abilities FROM warframes WHERE name LIKE '%Titania%'`)
  .all();

for (const w of frames) {
  console.log(`\n--- ${w.name} (${w.unique_name}) ---`);
  if (w.abilities) {
    const abs = JSON.parse(w.abilities);
    abs.forEach((a, i) => {
      console.log(`  [${i}] ${a.abilityName || a.name} — ${a.abilityUniqueName || a.uniqueName}`);
    });
  }
}

const xata = db
  .prepare(
    `SELECT unique_name, name, is_helminth_extractable FROM abilities
     WHERE name LIKE '%Xata%' OR unique_name LIKE '%Xata%'`,
  )
  .all();
console.log('\nXata abilities:', xata);

db.close();
