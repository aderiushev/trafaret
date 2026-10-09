import { EditorPage } from '@/pages/editor';
import { Providers } from './Providers';

export function App() {
  return (
    <Providers>
      <EditorPage />
    </Providers>
  );
}
