/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API REST (ex. https://api.exemple.mg/api/v1). Par défaut : /api/v1 (même origine / proxy Vite). */
  readonly VITE_API_URL?: string
  /** URL du canal temps réel. Par défaut : dérivée de VITE_API_URL (…/ws). */
  readonly VITE_WS_URL?: string
  /** "true" : mode démo, un faux serveur avec des données d'exemple remplace l'API (npm run dev:mock). */
  readonly VITE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
