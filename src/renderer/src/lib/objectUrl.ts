/**
 * 库内对象地址（渲染层）。
 *
 * 主进程注册了 `ember-object://` 协议，把"内容哈希"映射成"对象仓里的文件"。
 * 页面只知道哈希，不知道磁盘路径——库搬到别的机器、换个数据目录，
 * 地址都不用变，这也是内容寻址的一个额外好处。
 *
 * 两种写法在这里统一：
 * - 载体的 `objectHash` 字段（真实入库的文件）
 * - 载体 `coverUrl` 里的 `object://<hash>`（网页抓来的封面图）
 */

/** 对象哈希 → 可放进 img/video src 的 URL */
export function objectUrl(hash: string): string {
  return `ember-object://media/${hash}`
}

/** 解析可能带 `object://` 前缀的地址；不是对象地址就原样返回 */
export function resolveAssetUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith('object://')) return objectUrl(value.slice('object://'.length))
  return value
}
