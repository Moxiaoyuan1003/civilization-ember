/**
 * Mock 数据统一出口。
 *
 * 第 8 期起，演示数据（载体、技术树、用户、对话、文档）搬到了
 * `src/shared/seed/`——因为主进程播种数据库时也要用它们。
 * 这里只做转发，让渲染层原有的 `import { ... } from '@/mocks/data'` 继续可用。
 *
 * 仍留在本地的只有 `ingest.ts`（摄取队列的演示任务），
 * 它会在第 9 期做真摄取时被真实队列取代。
 */

export * from '@shared/seed/carriers'
export * from '@shared/seed/techTree'
export * from '@shared/seed/user'
export * from '@shared/seed/chat'
export * from '@shared/seed/documents'
export * from './ingest'
