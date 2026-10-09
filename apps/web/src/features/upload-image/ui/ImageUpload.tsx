import { assetUrl, UPLOAD_LIMITS } from '@trafaret/core';
import { useSamples } from '@/entities/asset';
import { Button, Dropzone, Spinner } from '@/shared/ui';
import { useUploadImage } from '../model/use-upload-image';
import styles from './ImageUpload.module.css';

export function ImageUpload({ nodeId, assetId }: { nodeId: string; assetId: string | null }) {
  const { upload, pickAsset, uploading, error } = useUploadImage(nodeId);
  const sample = useSamples().data?.[0];
  return (
    <div className={styles.upload}>
      <Dropzone
        label={assetId ? 'Replace image' : 'Upload image'}
        accept={UPLOAD_LIMITS.mimeTypes.join(',')}
        onFile={upload}
        disabled={uploading}
      >
        {assetId ? (
          <img src={assetUrl(assetId)} alt="Uploaded image" className={styles.preview} />
        ) : (
          <span>Drop an image here or click to choose one</span>
        )}
        {uploading && (
          <span className={styles.overlay}>
            <Spinner label="Uploading" />
          </span>
        )}
      </Dropzone>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!assetId && sample && (
        <Button size="sm" variant="ghost" onClick={() => pickAsset(sample.assetId)}>
          Use the sample photo
        </Button>
      )}
    </div>
  );
}
