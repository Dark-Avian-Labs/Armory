import fs from 'fs';

import Database from 'better-sqlite3';

const db = new Database('data/armory.db', { readonly: true });
const rows = db
  .prepare(
    `SELECT name, unique_name FROM weapons
     WHERE product_category = 'SentinelWeapons' AND name LIKE '%Claws%'
     ORDER BY name`,
  )
  .all();

const companionOverrides = {
  'Chesa Claws': 'Chesa Kubrow',
  'Huras Claws': 'Huras Kubrow',
  'Raksa Claws': 'Raksa Kubrow',
  'Sahasa Claws': 'Sahasa Kubrow',
  'Sunika Claws': 'Sunika Kubrow',
  'Helminth Claws': 'Helminth Charger',
  'Vizier Claws': 'Vizier Predasite',
  'Pharaoh Claws': 'Pharaoh Predasite',
  'Medjay Claws': 'Medjay Predasite',
  'Adarza Claws': 'Adarza Kavat',
  'Smeeta Claws': 'Smeeta Kavat',
  'Vasca Claws': 'Vasca Kavat',
  'Sly Claws': 'Sly Vulpaphyla',
  'Crescent Claws': 'Crescent Vulpaphyla',
  'Panzer Claws': 'Panzer Vulpaphyla',
  'Venari Claws': 'Venari',
  'Venari Prime Claws': 'Venari Prime',
};

const registry = rows.map((row) => ({
  companionName: companionOverrides[row.name] ?? row.name.replace(/ Claws$/, ''),
  clawsName: row.name,
  uniqueName: row.unique_name,
}));

fs.writeFileSync(
  'shared/beast-claw-registry.json',
  `${JSON.stringify(registry, null, 2)}\n`,
  'utf8',
);
console.log(`Wrote ${registry.length} entries`);
