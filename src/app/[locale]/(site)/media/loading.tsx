/**
 * This segment reads `searchParams`, so it needs its own boundary rather than inheriting
 * the group's spinner. Fourteen entries in four kinds — see `design/loading.tsx` for why
 * those numbers are literals.
 */
import { GridSkeleton } from '@/common/components/collection';

export default function Loading() {
  return <GridSkeleton cards={14} railOptions={4} />;
}
