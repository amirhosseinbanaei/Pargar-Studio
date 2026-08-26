// scripts/ci-fixture.ts — CI-only. Not a developer command; not wired to any npm script
// developers run by habit, and never a gate step.
//
// Next 16's Cache Components requires every `generateStaticParams` to return AT LEAST ONE
// result at build time (verified against the installed package: an empty array fails
// `npm run build` outright with "all generateStaticParams functions must return at least
// one result" — see https://nextjs.org/docs/messages/empty-generate-static-params). The
// project, design-work and media detail routes each derive their static params from the
// database, so CI's throwaway database — migrated but otherwise empty, because
// `scripts/seed.ts` and its one data source (`legacy/`) are gone (AGENTS.md) — fails the
// build with zero rows in any of those three tables.
//
// This script is NOT a seed. It writes exactly one minimal row per table
// `generateStaticParams` reads from, through the same repositories the app uses, so the
// build has something to generate a static page for. It is deliberately not
// `scripts/seed.ts` reborn: it carries no legacy data, no bilingual editorial content and
// no claim of being real — CI discards the database this runs against immediately after.
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from '../src/common/services/db';
import * as projectRepo from '../src/common/services/project-repository';
import * as designWorkRepo from '../src/common/services/design-work-repository';
import * as mediaRepo from '../src/common/services/media-repository';

async function main() {
  await migrate(db, { migrationsFolder: 'drizzle' });

  await projectRepo.create({
    slug: 'ci-fixture-project',
    types: ['Residential'],
    status: 'Completed',
    scale: 'Small',
    year: 2024,
    area: '',
    sortOrder: 0,
    titleEn: 'CI fixture project',
    titleFa: 'CI fixture project',
    blurbEn: '',
    blurbFa: '',
    descriptionEn: '',
    descriptionFa: '',
    locationEn: '',
    locationFa: '',
    clientEn: '',
    clientFa: '',
  });

  await designWorkRepo.create({
    slug: 'ci-fixture-design-work',
    category: 'Product',
    status: 'Completed',
    year: 2024,
    sortOrder: 0,
    titleEn: 'CI fixture design work',
    titleFa: 'CI fixture design work',
    blurbEn: '',
    blurbFa: '',
    clientEn: '',
    clientFa: '',
    scopeEn: '',
    scopeFa: '',
    materialsEn: '',
    materialsFa: '',
    descriptionEn: '',
    descriptionFa: '',
    teamEn: [],
    teamFa: [],
    factsEn: [],
    factsFa: [],
  });

  await mediaRepo.create({
    slug: 'ci-fixture-media',
    type: 'Publication',
    year: 2024,
    projectSlug: null,
    sortOrder: 0,
    titleEn: 'CI fixture media',
    titleFa: 'CI fixture media',
    outletEn: '',
    outletFa: '',
    blurbEn: '',
    blurbFa: '',
    authorEn: null,
    authorFa: null,
    excerptEn: '',
    excerptFa: '',
    contextEn: '',
    contextFa: '',
    factsEn: [],
    factsFa: [],
  });

  console.log('CI fixture rows written: 1 project, 1 design work, 1 media entry');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
