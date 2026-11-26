/**
 * 正文文档的读写（主进程）。
 *
 * 单独一个类而不是塞进 SqliteStorage：
 * documents 不属于 `StorageService` 契约（那 27 个方法是"用户数据"），
 * 它属于"解析产物"——由 DocumentService 负责，是另一条契约。
 * 两条契约共用同一个数据库连接，但职责分开，将来换解析器不动存储层。
 */

import type { Database } from 'node-sqlite3-wasm'
import type { BookDoc } from '@shared/types/book'
import type { Row } from '../storage/rowmap'
import { rowHelpers } from '../storage/rowmap'

export class DocumentRepo {
  constructor(private readonly db: Database) {}

  /** 取某载体的正文（没有则 null） */
  get(carrierId: string): BookDoc | null {
    const row = this.db.get(`SELECT * FROM documents WHERE carrier_id = ?`, [
      carrierId
    ]) as Row | null
    if (!row) return null
    return {
      carrierId: rowHelpers.str(row.carrier_id),
      title: rowHelpers.str(row.title),
      subtitle: rowHelpers.optStr(row.subtitle),
      pages: rowHelpers.parseJson<BookDoc['pages']>(row.pages, []),
      toc: rowHelpers.parseJson<BookDoc['toc']>(row.toc, [])
    }
  }

  /** 写入（或覆盖）某个载体的正文 */
  save(doc: BookDoc): void {
    this.db.run(
      `INSERT INTO documents (carrier_id, title, subtitle, pages, toc, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(carrier_id) DO UPDATE SET
         title = excluded.title,
         subtitle = excluded.subtitle,
         pages = excluded.pages,
         toc = excluded.toc`,
      [
        doc.carrierId,
        doc.title,
        doc.subtitle ?? null,
        JSON.stringify(doc.pages),
        JSON.stringify(doc.toc),
        new Date().toISOString()
      ]
    )
  }

  /** 删除某载体的正文（重解析前清掉旧的） */
  remove(carrierId: string): void {
    this.db.run(`DELETE FROM documents WHERE carrier_id = ?`, [carrierId])
  }
}

/**
 * 文档服务（对外契约的实现）。
 *
 * 为什么要包一层而不是直接把 `DocumentRepo` 当服务用：
 * 契约里的方法名是 `getBookDoc`，而仓库层用的是更短的 `get`。
 * IPC 派发是按方法名在目标对象上找函数的，名字对不上就会报
 * "document方法不可用：getBookDoc"（踩过一次）。
 * 包一层之后，仓库层的命名可以继续贴近数据库，契约层的命名可以继续贴近调用方。
 */
export class DocumentServiceImpl {
  private readonly repo: DocumentRepo

  constructor(db: Database) {
    this.repo = new DocumentRepo(db)
  }

  /** 取某载体的正文（没有则 null） */
  async getBookDoc(carrierId: string): Promise<BookDoc | null> {
    return this.repo.get(carrierId)
  }
}
