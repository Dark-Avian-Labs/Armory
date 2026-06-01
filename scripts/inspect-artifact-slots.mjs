import Database from 'better-sqlite3';

const dbPath = process.argv[2] ?? 'data/armory.db';
const db = new Database(dbPath, { readonly: true });

const wfCount = db
  .prepare(
    `SELECT COUNT(*) AS c FROM warframes WHERE artifact_slots IS NOT NULL AND TRIM(artifact_slots) <> ''`,
  )
  .get();
console.log('warframes with artifact_slots:', wfCount.c);

const samples = db
  .prepare(
    `SELECT name, unique_name, product_category, artifact_slots FROM warframes
     WHERE artifact_slots IS NOT NULL AND TRIM(artifact_slots) <> ''
     ORDER BY name LIMIT 20`,
  )
  .all();
for (const r of samples) {
  const a = JSON.parse(r.artifact_slots);
  console.log(
    `${r.name} (${r.product_category}) len=${r.artifact_slots.length} arr=${a.length}`,
    a.slice(8),
  );
}

const jade = db
  .prepare(
    `SELECT name, unique_name, artifact_slots FROM warframes WHERE LOWER(name) = 'jade' OR unique_name LIKE '%/Choir/%'`,
  )
  .all();
console.log('\nJade:', jade);

const mechs = db
  .prepare(
    `SELECT name, product_category, artifact_slots FROM warframes
     WHERE product_category IN ('Necramechs', 'MechSuits') AND artifact_slots IS NOT NULL LIMIT 8`,
  )
  .all();
for (const r of mechs) {
  const a = JSON.parse(r.artifact_slots);
  console.log(`\n${r.name} (${r.product_category}) arr=${a.length}`, a);
}

const weapons = db
  .prepare(
    `SELECT COUNT(*) AS c FROM weapons WHERE artifact_slots IS NOT NULL AND TRIM(artifact_slots) <> ''`,
  )
  .get();
console.log('\nweapons with artifact_slots:', weapons.c);

const companions = db
  .prepare(
    `SELECT COUNT(*) AS c FROM companions WHERE artifact_slots IS NOT NULL AND TRIM(artifact_slots) <> ''`,
  )
  .get();
console.log('companions with artifact_slots:', companions.c);

db.close();
