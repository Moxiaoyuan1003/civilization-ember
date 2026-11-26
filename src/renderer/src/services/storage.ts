/**
 * 存储服务接口（渲染进程侧入口）。
 *
 * 第 8 期起，接口契约搬到了 `@shared/contracts/storage`——因为主进程实现它、
 * 渲染进程消费它，两边必须共用同一份定义（否则改一处忘一处，IPC 立刻对不上）。
 *
 * 这里只做转发，让渲染层继续 `import type { StorageService } from '@/services/storage'`，
 * 一期写的几十个 store / 组件一行都不用改。
 */

export type { StorageService, StorageMethod } from '@shared/contracts/storage'
export { STORAGE_METHODS } from '@shared/contracts/storage'
