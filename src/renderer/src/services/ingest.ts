/**
 * 摄取服务（渲染层转发）。
 *
 * 与 `storage.ts` 一样：真正的接口定义在 `@shared/contracts/ingest`，
 * 这里只做转发，让页面里的 `import type { IngestService } from '@/services/ingest'` 保持不变。
 */

export type { IngestService, ImportOutcome, IngestMethod } from '@shared/contracts/ingest'
export { INGEST_METHODS, INGEST_FILE_EXTENSIONS, INGEST_CHANNEL } from '@shared/contracts/ingest'
