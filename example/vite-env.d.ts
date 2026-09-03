/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LABS_PRODUCT_ID?: string;
  readonly VITE_LABS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
