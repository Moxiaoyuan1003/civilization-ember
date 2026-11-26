/**
 * 文档服务接口（Document Service）。
 *
 * 阅读器的数据源抽象：把"载体 id"翻译成"可读的页文档"。
 *
 * 第 9 期起有两条实现：
 * - `mocks/document.ts`：读预置演示文档（浏览器里跑、或演示数据）。
 * - `services/documentIpc.ts`：真的去主进程读解析产物（documents 表）。
 *
 * 页面只依赖这个接口，换解析实现不动阅读器代码。
 */

export type { DocumentService } from '@shared/contracts/document'
export { DOCUMENT_CHANNEL, DOCUMENT_METHODS } from '@shared/contracts/document'
