/// <reference types="vite/client" />
import type { RingfoldApi } from '../../shared/types'

declare global {
  interface Window {
    api: RingfoldApi
  }
}

export {}
