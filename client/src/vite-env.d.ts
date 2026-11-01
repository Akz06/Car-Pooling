/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_DEMO?: string;
  readonly VITE_ROUTER?: 'hash' | 'memory';
  readonly VITE_PHOTOS_OFF?: string;
}
