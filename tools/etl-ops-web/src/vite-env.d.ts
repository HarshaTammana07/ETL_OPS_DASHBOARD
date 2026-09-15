/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Hosted FastAPI prefix, e.g. https://your-api.example.com/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
