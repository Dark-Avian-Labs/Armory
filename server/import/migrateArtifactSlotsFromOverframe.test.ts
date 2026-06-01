import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  hasLegacyOverframeArtifactSlotData,
  JADE_WARFRAME_UNIQUE_NAME,
  migrateArtifactSlotsFromOverframe,
  migrateJadeArtifactSlots,
  migrateNecramechArtifactSlots,
} from './migrateArtifactSlotsFromOverframe.js';

describe('migrateJadeArtifactSlots', () => {
  it('maps legacy 13-slot Overframe Jade into 11-slot extended layout', () => {
    const legacy = [
      'AP_UNIVERSAL',
      'AP_TACTIC',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_DEFENSE',
      'AP_UNIVERSAL',
      'AP_ANY',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
    ];
    expect(migrateJadeArtifactSlots(legacy)).toEqual([
      'AP_UNIVERSAL',
      'AP_TACTIC',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_UNIVERSAL',
      'AP_DEFENSE',
      'AP_ANY',
      'AP_UNIVERSAL',
    ]);
  });
});

describe('migrateNecramechArtifactSlots', () => {
  it('truncates to 12 general slots', () => {
    const legacy = Array.from({ length: 12 }, (_, i) => (i === 0 ? 'AP_ATTACK' : 'AP_UNIVERSAL'));
    expect(migrateNecramechArtifactSlots(legacy)).toHaveLength(12);
    expect(migrateNecramechArtifactSlots(legacy)[0]).toBe('AP_ATTACK');
  });
});

describe('hasLegacyOverframeArtifactSlotData', () => {
  it('returns false for compact Jade and NULL other warframes', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE warframes (
        unique_name TEXT PRIMARY KEY,
        name TEXT,
        product_category TEXT,
        artifact_slots TEXT
      );
      CREATE TABLE weapons (unique_name TEXT PRIMARY KEY, artifact_slots TEXT);
      CREATE TABLE companions (unique_name TEXT PRIMARY KEY, artifact_slots TEXT);
    `);
    db.prepare(`INSERT INTO warframes VALUES (?, ?, ?, ?)`).run(
      JADE_WARFRAME_UNIQUE_NAME,
      'Jade',
      'Warframes',
      JSON.stringify([...Array(8).fill('AP_UNIVERSAL'), 'AP_DEFENSE', 'AP_ANY', 'AP_UNIVERSAL']),
    );
    db.prepare(`INSERT INTO warframes VALUES (?, ?, ?, ?)`).run('/Lotus/Ash', 'Ash', 'Warframes', null);
    expect(hasLegacyOverframeArtifactSlotData(db)).toBe(false);
    db.close();
  });

  it('returns true for 12-slot Overframe warframe rows', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE warframes (
        unique_name TEXT PRIMARY KEY,
        name TEXT,
        product_category TEXT,
        artifact_slots TEXT
      );
      CREATE TABLE weapons (unique_name TEXT PRIMARY KEY, artifact_slots TEXT);
      CREATE TABLE companions (unique_name TEXT PRIMARY KEY, artifact_slots TEXT);
    `);
    db.prepare(`INSERT INTO warframes VALUES (?, ?, ?, ?)`).run(
      '/Lotus/Ash',
      'Ash',
      'Warframes',
      JSON.stringify(Array(12).fill('AP_UNIVERSAL')),
    );
    expect(hasLegacyOverframeArtifactSlotData(db)).toBe(true);
    db.close();
  });
});

describe('migrateArtifactSlotsFromOverframe', () => {
  it('clears warframes except Jade and necramechs', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE warframes (
        unique_name TEXT PRIMARY KEY,
        name TEXT,
        product_category TEXT,
        artifact_slots TEXT
      );
      CREATE TABLE weapons (unique_name TEXT PRIMARY KEY, artifact_slots TEXT);
      CREATE TABLE companions (unique_name TEXT PRIMARY KEY, artifact_slots TEXT);
    `);
    db.prepare(`INSERT INTO warframes VALUES (?, ?, ?, ?)`).run(
      '/Lotus/Ash',
      'Ash',
      'Warframes',
      JSON.stringify(Array(12).fill('AP_UNIVERSAL')),
    );
    db.prepare(`INSERT INTO warframes VALUES (?, ?, ?, ?)`).run(
      JADE_WARFRAME_UNIQUE_NAME,
      'Jade',
      'Warframes',
      JSON.stringify([
        ...Array(8).fill('AP_UNIVERSAL'),
        'AP_DEFENSE',
        'AP_UNIVERSAL',
        'AP_ANY',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
      ]),
    );
    db.prepare(`INSERT INTO warframes VALUES (?, ?, ?, ?)`).run(
      '/Lotus/Voidrig',
      'Voidrig',
      'MechSuits',
      JSON.stringify(Array(12).fill('AP_ATTACK')),
    );
    db.prepare(`INSERT INTO weapons VALUES (?, ?)`).run('/Lotus/Gun', JSON.stringify(Array(10).fill('AP_UNIVERSAL')));

    const summary = migrateArtifactSlotsFromOverframe(db);
    expect(summary.warframesCleared).toBe(1);
    expect(summary.warframesJadeUpdated).toBe(1);
    expect(summary.warframesNecramechUpdated).toBe(1);
    expect(summary.weaponsCleared).toBe(1);

    expect(
      (
        db.prepare(`SELECT artifact_slots FROM warframes WHERE name = 'Ash'`).get() as {
          artifact_slots: string | null;
        }
      ).artifact_slots,
    ).toBeNull();

    const jade = JSON.parse(
      (
        db.prepare(`SELECT artifact_slots FROM warframes WHERE name = 'Jade'`).get() as {
          artifact_slots: string;
        }
      ).artifact_slots,
    ) as string[];
    expect(jade).toHaveLength(11);
    expect(jade[9]).toBe('AP_ANY');

    const voidrig = JSON.parse(
      (
        db.prepare(`SELECT artifact_slots FROM warframes WHERE name = 'Voidrig'`).get() as {
          artifact_slots: string;
        }
      ).artifact_slots,
    ) as string[];
    expect(voidrig).toHaveLength(12);

    db.close();
  });
});
