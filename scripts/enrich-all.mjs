/**
 * Enrichment Pipeline Orchestrator
 *
 * Runs all enrichment scripts in sequence:
 * 1. JMDict (PoS enrichment + validation)
 * 2. Frequency (replace rank=0 placeholders)
 * 3. KanjiAPI (kanji metadata validation)
 *
 * Usage: node scripts/enrich-all.mjs
 *
 * Each script is idempotent and safe to re-run.
 * Reports are written to scripts/reports/
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const scripts = [
	{
		name: "JMDict Enrichment",
		cmd: "node scripts/enrich-jmdict.mjs",
		requiredFile: "scripts/data/jmdict-eng-3.6.2.json",
		skipMessage:
			"Skipping: download jmdict-eng JSON from https://github.com/scriptin/jmdict-simplified/releases",
	},
	{
		name: "Frequency Enrichment",
		cmd: "node scripts/enrich-frequency.mjs",
		requiredFile: "scripts/data/jpdb-freq.csv",
		skipMessage: "Skipping: place jpdb-freq.csv in scripts/data/",
	},
	{
		name: "KanjiAPI Validation",
		cmd: "node scripts/enrich-kanjiapi.mjs",
		requiredFile: null,
	},
];

console.log("=== Janki Data Enrichment Pipeline ===\n");

let ran = 0;
let skipped = 0;

for (const script of scripts) {
	console.log(`--- ${script.name} ---`);

	if (script.requiredFile && !existsSync(script.requiredFile)) {
		console.log(script.skipMessage);
		console.log();
		skipped++;
		continue;
	}

	try {
		execSync(script.cmd, { stdio: "inherit" });
		ran++;
	} catch (err) {
		console.error(`Failed: ${err.message}`);
	}
	console.log();
}

console.log(`=== Done: ${ran} ran, ${skipped} skipped ===`);
