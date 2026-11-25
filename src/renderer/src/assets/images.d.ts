/**
 * 图片模块声明：让 TypeScript 认识 .jpg / .png 等图片资源的 import。
 *
 * Vite 自带这些类型（vite/client），但本项目 tsconfig 没引 vite/client，
 * 所以这里手动声明，避免 import cover from './x.jpg' 报 TS2307。
 */

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}
