import type { CourseLab, LabReference } from './courseLabShared.ts';
import { LAB_REFERENCES } from './labsRegistry.ts';
import courseLabsMeta from './courseLabsMeta.json' with { type: 'json' };
export type { CourseLab, LabReference } from './courseLabShared.ts';

interface CourseLabMeta {
  id: string;
  number: number;
  title: string;
  sourceUrl: string;
  objectives: string[];
  limitations: string;
  referenceIds: string[];
}

const referenceById = new Map(LAB_REFERENCES.map(ref => [ref.id, ref]));

function resolveReferences(meta: CourseLabMeta): LabReference[] {
  return meta.referenceIds.map(id => {
    const ref = referenceById.get(id);
    if (!ref) throw new Error(`Course lab "${meta.id}" references "${id}", which has no file in src/data/labs/.`);
    return ref;
  });
}

export const COURSE_LABS: CourseLab[] = (courseLabsMeta as CourseLabMeta[]).map(meta => ({
  id: meta.id, number: meta.number, title: meta.title, sourceUrl: meta.sourceUrl,
  objectives: meta.objectives, limitations: meta.limitations, references: resolveReferences(meta)
}));
