import { useReactFlow } from '@xyflow/react';
import { useRef } from 'react';
import { useRunSession } from '@/entities/run';
import { getWorkflowGraph, useWorkflowStore } from '@/entities/workflow';
import { downloadJson } from '@/shared/lib';
import { Button, toast } from '@/shared/ui';
import { parseWorkflowFile, toWorkflowFile, WORKFLOW_FILE_NAME } from '../lib/workflow-file';

export function ExportImportButtons() {
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const clearRun = useRunSession((state) => state.clear);
  const { fitView } = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = async (file: File): Promise<void> => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error("Couldn't read that file.", ['Choose the file again.']);
      return;
    }
    const graph = parseWorkflowFile(text);
    if (!graph) {
      toast.error("This file isn't a Trafaret workflow.", ['Export a workflow to see the expected format.']);
      return;
    }
    replaceGraph(graph);
    clearRun();
    void fitView({ padding: 0.15, maxZoom: 1 });
    toast.info(`Imported ${file.name}.`);
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
        Import
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Workflow file to import"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importFile(file);
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        title="Download the workflow as JSON — the same body POST /api/runs takes"
        onClick={() => downloadJson(WORKFLOW_FILE_NAME, toWorkflowFile(getWorkflowGraph()))}
      >
        Export
      </Button>
    </>
  );
}
