// src/modules/projects/components/ProjectsScreen.tsx
/**
 * The projects index: the filter rail beside the grid.
 *
 * The whole screen is a Server Component. The only JavaScript it ships is `CardReveal`,
 * which adds a class — the cards, their drawings, the filter links and the counts are all
 * in the HTML.
 */
import { CardReveal } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import type { Project } from '@/common/schemas/project';
import { filterProjects, type ProjectFilters } from '../lib/filters';
import { ProjectCard } from './ProjectCard';
import { ProjectFilterRail, type FilterTaxonomy } from './ProjectFilterRail';

const GRID_ID = 'projects-grid';

export interface ProjectsScreenProps {
  projects: readonly Project[];
  taxonomy: FilterTaxonomy;
  filters: ProjectFilters;
  basePath: string;
  dictionary: Dictionary;
}

export function ProjectsScreen({
  projects,
  taxonomy,
  filters,
  basePath,
  dictionary,
}: ProjectsScreenProps) {
  // Filtered HERE, on the server. The legacy grid rendered all 76 cards and hid the
  // non-matching ones with `.is-out`; a server render has no reason to ship what it is
  // about to hide.
  const shown = filterProjects(projects, filters);

  return (
    <div className="route" id="main">
      <ProjectFilterRail
        taxonomy={taxonomy}
        filters={filters}
        projects={projects}
        shown={shown.length}
        basePath={basePath}
        dictionary={dictionary}
      />

      <div className="route__main">
        <div className="grid" id={GRID_ID}>
          {shown.map(project => (
            <ProjectCard key={project.slug} project={project} dictionary={dictionary} />
          ))}
        </div>

        {shown.length === 0 && <p className="empty">{dictionary.t('filter.noMatch')}</p>}

        <CardReveal gridId={GRID_ID} />
      </div>
    </div>
  );
}
