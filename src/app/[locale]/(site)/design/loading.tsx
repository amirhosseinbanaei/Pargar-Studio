/**
 * This segment reads `searchParams`, which makes it request-dependent, so it needs its own
 * boundary rather than inheriting the group's spinner.
 *
 * The numbers are the archive's: nine works in six categories. They are literals because
 * the fallback has to be rendered before any query has answered — a skeleton that asked
 * the database how many boxes to draw would be the very wait it stands in for.
 */
import { GridSkeleton } from '@/common/components/collection';

export default function Loading() {
  return <GridSkeleton cards={9} railOptions={6} />;
}
