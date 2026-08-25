// src/app/[locale]/(site)/projects/loading.tsx
/**
 * The index awaits data before it can paint, and its filters come from `searchParams` —
 * which makes it request-dependent, so this segment needs its own boundary rather than
 * inheriting the group's.
 *
 * It renders a component from the module barrel and defines nothing itself: a skeleton
 * written here would drift from the screen it stands in for the first time a card grows a
 * line.
 */
import { ProjectsScreenSkeleton } from '@/modules/projects';

export default function Loading() {
  return <ProjectsScreenSkeleton />;
}
