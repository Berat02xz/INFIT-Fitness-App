import Constants from 'expo-constants'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'
import { NativeModules } from 'react-native'
import { schema } from './schema'
import { migrations } from './migrations'

export const isExpoGo = Constants.appOwnership === 'expo'
export const hasWatermelonNativeBridge = Boolean(
  NativeModules.WMDatabaseBridge || NativeModules.WMDatabaseJSIBridge
)
export const usesLokiFallback = isExpoGo || !hasWatermelonNativeBridge
export const databaseRuntime = {
  appOwnership: Constants.appOwnership ?? 'none',
  executionEnvironment: Constants.executionEnvironment ?? 'unknown',
  adapter: usesLokiFallback ? 'LokiJS (memory)' : 'SQLite',
  hasWatermelonNativeBridge,
  persistenceBridgeEnabled: usesLokiFallback,
}

const createAdapter = () => {
  if (usesLokiFallback) {
    if (isExpoGo) {
      console.warn(
        '[database] Expo Go uses an in-memory WatermelonDB fallback with an AsyncStorage activity snapshot. Development builds use native SQLite.'
      )
    } else {
      console.warn(
        '[database] WatermelonDB native bridge is unavailable; using LokiJS fallback. Rebuild the dev client to use native SQLite.'
      )
    }

    return new LokiJSAdapter({
      schema,
      migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      onSetUpError: error => {
        console.error('[database] WatermelonDB setup failed. Local data was preserved.', error)
      },
    })
  }

  return new SQLiteAdapter({
    schema,
    migrations,
    jsi: true,
    onSetUpError: error => {
      console.error('[database] WatermelonDB setup failed. Local data was preserved.', error)
    },
  })
}

export const adapter = createAdapter()
