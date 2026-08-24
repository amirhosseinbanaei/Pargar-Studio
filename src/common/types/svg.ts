// src/common/types/svg.ts
import type { RefAttributes, SVGProps } from 'react';

/** The one prop type every icon in `common/icons/` takes. */
export interface SvgIcon extends RefAttributes<SVGSVGElement>, Partial<SVGProps<SVGSVGElement>> {
  size?: string | number;
}
