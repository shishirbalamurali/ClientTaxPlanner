#!/usr/bin/env tsx
/**
 * Generates a cohort of synthetic client records and reports how the rule set
 * behaves across it. Run with `npm run generate:clients`.
 *
 *   --count   number of records to generate (default 100)
 *   --seed    PRNG seed; the same seed always produces the same cohort
 *   --year    modeled tax year
 *   --out     output directory (default ./data-generated)
 *   --quiet   suppress the coverage report
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_GENERATOR_OPTIONS, generateCohort } from '../src/data/synthetic/generator';
import { RULE_CATALOG, evaluateClient } from '../src/lib/rules';

interface Options {
  count: number;
  seed: number;
  year: number;
  out: string;
  quiet: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    count: DEFAULT_GENERATOR_OPTIONS.count,
    seed: DEFAULT_GENERATOR_OPTIONS.seed,
    year: DEFAULT_GENERATOR_OPTIONS.taxYear,
    out: 'data-generated',
    quiet: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const value = argv[i + 1];
    switch (arg) {
      case '--count':
        options.count = Number(value);
        i += 1;
        break;
      case '--seed':
        options.seed = Number(value);
        i += 1;
        break;
      case '--year':
        options.year = Number(value);
        i += 1;
        break;
      case '--out':
        options.out = String(value);
        i += 1;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unrecognised option ${arg}.`);
        }
    }
  }

  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error('--count must be a positive integer.');
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const cohort = generateCohort({
    count: options.count,
    seed: options.seed,
    taxYear: options.year,
  });

  const outDir = resolve(process.cwd(), options.out);
  mkdirSync(outDir, { recursive: true });

  const clientsPath = join(outDir, `synthetic-clients-${options.year}.json`);
  writeFileSync(clientsPath, `${JSON.stringify(cohort, null, 2)}\n`);

  const ruleCounts = new Map<string, number>(RULE_CATALOG.map((rule) => [rule.id, 0]));
  const summaryRows: string[] = [
    'client_id,archetype,filing_status,state,total_income,federal_tax,review,monitor,informational,gift_excess,foreign_aggregate_max,fbar_flag,form_8938_flag,trusts',
  ];

  for (const client of cohort) {
    const evaluation = evaluateClient(client);
    for (const finding of evaluation.findings) {
      ruleCounts.set(finding.ruleId, (ruleCounts.get(finding.ruleId) ?? 0) + 1);
    }
    summaryRows.push(
      [
        client.id,
        client.archetype,
        client.filingStatus,
        client.residency.stateCode,
        Math.round(evaluation.federal.income.totalModeledIncome),
        Math.round(evaluation.federal.totalFederalTax),
        evaluation.reviewCount,
        evaluation.monitorCount,
        evaluation.informationalCount,
        Math.round(evaluation.gifts.totalExceedingExclusion),
        Math.round(evaluation.foreign.aggregateMaximumValue),
        evaluation.foreign.fbarReviewFlag ? 1 : 0,
        evaluation.foreign.form8938ReviewFlag ? 1 : 0,
        client.trusts.length,
      ].join(','),
    );
  }

  const summaryPath = join(outDir, `synthetic-clients-${options.year}-summary.csv`);
  writeFileSync(summaryPath, `${summaryRows.join('\n')}\n`);

  if (options.quiet) return;

  const untriggered = [...ruleCounts.entries()].filter(([, count]) => count === 0);

  process.stdout.write(
    [
      `Generated ${cohort.length} synthetic ${options.year} client records (seed ${options.seed}).`,
      `  ${clientsPath}`,
      `  ${summaryPath}`,
      '',
      'Rule coverage across the cohort:',
      ...[...ruleCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => `  ${id.padEnd(30)} ${String(count).padStart(5)}`),
      '',
      untriggered.length === 0
        ? 'Every rule fired at least once.'
        : `Rules not triggered by this cohort: ${untriggered.map(([id]) => id).join(', ')}`,
      '',
    ].join('\n'),
  );
}

main();
