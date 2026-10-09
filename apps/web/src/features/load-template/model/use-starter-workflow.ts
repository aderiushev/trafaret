import { useEffect, useEffectEvent } from 'react';
import { useWorkflowStore } from '@/entities/workflow';
import type { TemplateId } from './templates';
import { useLoadTemplate } from './use-load-template';

const STARTER: TemplateId = 'two-styles';

/** On a first visit, or when no saved workflow could be loaded, the canvas opens with the branching workflow. */
export function useStarterWorkflow(): void {
  const needsStarter = useWorkflowStore((state) => state.needsStarter);
  const { load, ready } = useLoadTemplate();
  const placeStarter = useEffectEvent(() => {
    // Read the live value: in development React runs effects twice, and the first run already placed it.
    if (useWorkflowStore.getState().needsStarter) load(STARTER);
  });
  useEffect(() => {
    if (needsStarter && ready) placeStarter();
  }, [needsStarter, ready]);
}
