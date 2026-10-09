import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { uploadAsset, uploadProblem } from '@/entities/asset';
import { useWorkflowStore } from '@/entities/workflow';
import { toApiError } from '@/shared/api';

/** Uploads a photo for an Image Input node, checking the server's limits first. */
export function useUploadImage(nodeId: string) {
  const update = useWorkflowStore((state) => state.updateNodeData);
  const [problem, setProblem] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: uploadAsset,
    onSuccess: (asset) => update(nodeId, 'imageInput', { assetId: asset.assetId }),
  });

  const upload = (file: File): void => {
    const reason = uploadProblem(file);
    setProblem(reason);
    if (reason === null) mutation.mutate(file);
  };
  const pickAsset = (assetId: string): void => update(nodeId, 'imageInput', { assetId });

  return {
    upload,
    pickAsset,
    uploading: mutation.isPending,
    error: problem ?? (mutation.error ? toApiError(mutation.error).message : null),
  };
}
