// adapter.web.ts
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'
import { schema } from './schema'
import { migrations } from './migrations'

export const isExpoGo = false
export const hasWatermelonNativeBridge = false
export const usesLokiFallback = true
export const databaseRuntime = {
  appOwnership: 'web',
  executionEnvironment: 'web',
  adapter: 'LokiJS (IndexedDB)',
  hasWatermelonNativeBridge,
  persistenceBridgeEnabled: usesLokiFallback,
}

export const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: error => {
    console.error('[database] WatermelonDB setup failed. Local data was preserved.', error)
  },
})
