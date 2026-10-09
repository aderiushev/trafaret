import { useReactFlow } from '@xyflow/react';
import { useSamples } from '@/entities/asset';
import { defaultModelId, useCatalog } from '@/entities/catalog';
import { useRunSession } from '@/entities/run';
import { useWorkflowStore } from '@/entities/workflow';
import { toast } from '@/shared/ui';
import { instantiateTemplate, type TemplateId } from './templates';

/** Replaces the canvas with a template, built with the server's models and sample photo. */
export function useLoadTemplate(): { load: (id: TemplateId) => void; ready: boolean } {
  const { data: models } = useCatalog();
  const samples = useSamples();
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const clearRun = useRunSession((state) => state.clear);
  const { fitView } = useReactFlow();

  const load = (id: TemplateId): void => {
    const modelId = defaultModelId(models ?? [], 'generate');
    const editModelId = defaultModelId(models ?? [], 'edit');
    if (modelId === null || editModelId === null) {
      toast.error('No image model is available.', ['Check that the server is running.']);
      return;
    }
    replaceGraph(
      instantiateTemplate(id, { modelId, editModelId, sampleAssetId: samples.data?.[0]?.assetId ?? null }),
    );
    clearRun();
    // React Flow waits until the new nodes are measured.
    void fitView({ padding: 0.15, maxZoom: 1 });
  };

  return { load, ready: models !== undefined && !samples.isPending };
}
