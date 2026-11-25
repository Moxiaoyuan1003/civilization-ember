/**
 * Mock 数据统一出口。
 *
 * 所有假数据从这里 re-export，方便 mock 服务与后续页面引用。
 * 后续接真实后端时，这些 mock 数据整体替换，不影响页面代码。
 */

export * from './carriers'
export * from './techTree'
export * from './user'
export * from './chat'
export * from './ingest'
export * from './documents'
