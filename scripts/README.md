# Janki Data Enrichment Scripts

Build-time scripts that enrich vocabulary seed data using external reference sources.

## Setup

### 1. JMDict (Part of Speech + Validation)

Download `jmdict-eng-3.5.0.json` (or latest) from:
https://github.com/scriptin/jmdict-simplified/releases

Place it at: `scripts/data/jmdict-eng-3.5.0.json`

### 2. Frequency List

Place a TSV frequency file at: `scripts/data/frequency.tsv`

Format: tab-separated with columns `word`, `reading`, `rank` (or 2-column `word`, `rank`).
Lines starting with `#` are treated as comments.

Compatible sources:
- Innocent Corpus: https://github.com/wareya/jpfreq
- Wikipedia JP frequency: https://github.com/scriptin/wikipedia-word-frequency-jp
- jpdb community exports

### 3. KanjiAPI

No setup needed. Uses the free kanjiapi.dev API. Responses are cached in `scripts/.cache/kanjiapi/` so re-runs don't re-fetch.

## Running

```bash
# Run all scripts in sequence (skips any with missing data files)
npm run enrich

# Run individually
npm run enrich:jmdict
npm run enrich:frequency
npm run enrich:kanjiapi
```

## What Each Script Does

| Script | Modifies Data? | Output |
|--------|---------------|--------|
| `enrich-jmdict` | Yes -- fills `part_of_speech` on vocab items | `scripts/reports/jmdict-enrichment.json` |
| `enrich-frequency` | Yes -- replaces `frequency_rank: 0` placeholders | `scripts/reports/frequency-enrichment.json` |
| `enrich-kanjiapi` | No -- validation only | `scripts/reports/kanjiapi-validation.json` |

All scripts are idempotent and safe to re-run. Reports include match rates, conflicts, and sample data for manual review.

## Directory Structure

```
scripts/
  data/           # Reference data files (gitignored)
  reports/        # Enrichment reports (gitignored)
  .cache/         # API response cache (gitignored)
  enrich-all.mjs
  enrich-jmdict.mjs
  enrich-frequency.mjs
  enrich-kanjiapi.mjs
```
