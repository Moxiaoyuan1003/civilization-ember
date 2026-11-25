/**
 * Mock 载体数据（取火→冶铁→蒸汽机 链路涉及的书/视频/音频/网页）。
 *
 * 这些是"火种"里最早的一批原始载体，用来验证整条链路：
 * 取火（L0）→ 冶铁（L1）→ 蒸汽机（L3），每个节点都有引用载体支撑。
 */

import type { Carrier, Transcript } from '@/types/carrier'

/** Mock 载体列表 */
export const mockCarriers: Carrier[] = [
  {
    id: 'c-book-survival',
    title: '野外生存手册',
    type: 'book',
    format: 'pdf',
    authors: ['佚名·文明火种编委会'],
    description: '从零重建文明的第一本手册：取火、取水、搭建庇护所、基础工具。',
    sizeBytes: 24_500_000,
    tags: ['生存', '取火', '基础'],
    contentHash: 'hash-book-survival-0001',
    filePath: 'library/survival-handbook.pdf',
    status: 'ready',
    ingestedAt: '2026-01-12T09:00:00Z',
    createdAt: '2026-01-12T08:30:00Z'
  },
  {
    id: 'c-video-fire',
    title: '钻木取火实拍教学',
    type: 'video',
    format: 'mp4',
    authors: ['火种影像组'],
    description: '三种取火方法（钻木、火石、放大镜聚光）的完整实拍，含失败与纠正。',
    sizeBytes: 414_868,
    durationSec: 90,
    tags: ['取火', '视频', '演示'],
    contentHash: 'hash-video-fire-0002',
    filePath: 'library/fire-drilling.mp4',
    status: 'ready',
    ingestedAt: '2026-01-15T10:20:00Z',
    createdAt: '2026-01-15T10:00:00Z'
  },
  {
    id: 'c-book-metallurgy',
    title: '冶金原理（简化版）',
    type: 'book',
    format: 'epub',
    authors: ['文明火种·工程组'],
    description: '从矿石到金属：选矿、还原、冶炼、锻打。冶铁是文明的关键一跃。',
    sizeBytes: 18_200_000,
    tags: ['冶铁', '冶金', '物质'],
    contentHash: 'hash-book-metallurgy-0003',
    filePath: 'library/metallurgy.epub',
    status: 'ready',
    ingestedAt: '2026-01-20T14:00:00Z',
    createdAt: '2026-01-20T13:30:00Z'
  },
  {
    id: 'c-audio-iron',
    title: '冶铁工艺口述史',
    type: 'audio',
    format: 'mp3',
    authors: ['老铁匠口述'],
    description: '一位老铁匠口述的鼓风炉、淬火、锻打全流程，含大量口耳相传的经验。',
    sizeBytes: 1_440_750,
    durationSec: 120,
    tags: ['冶铁', '口述', '淬火'],
    contentHash: 'hash-audio-iron-0004',
    filePath: 'library/iron-oral-history.mp3',
    status: 'ready',
    ingestedAt: '2026-01-22T16:40:00Z',
    createdAt: '2026-01-22T16:00:00Z'
  },
  {
    id: 'c-book-steam',
    title: '蒸汽机原理与制造',
    type: 'book',
    format: 'pdf',
    authors: ['文明火种·机械组'],
    description: '从瓦特蒸汽机到现代蒸汽轮机的完整原理、图纸与制造工艺。',
    sizeBytes: 62_300_000,
    tags: ['蒸汽机', '能源', '机械'],
    contentHash: 'hash-book-steam-0005',
    filePath: 'library/steam-engine.pdf',
    status: 'ready',
    ingestedAt: '2026-01-28T11:10:00Z',
    createdAt: '2026-01-28T10:40:00Z'
  },
  {
    id: 'c-web-charcoal',
    title: '木炭烧制百科页',
    type: 'webpage',
    format: 'html',
    authors: ['百科存档'],
    description: '木炭烧制：闷窑、密封、控温。木炭是冶铁燃料的关键前置。',
    tags: ['木炭', '冶铁', '燃料'],
    contentHash: 'hash-web-charcoal-0006',
    sourceUrl: 'https://example.org/charcoal',
    status: 'ready',
    ingestedAt: '2026-01-25T09:00:00Z',
    createdAt: '2026-01-25T08:50:00Z'
  },
  {
    id: 'c-audio-lost',
    title: '窑工口述：陶器与耐火砖',
    type: 'audio',
    format: 'mp3',
    authors: ['老窑工口述·残卷'],
    description:
      '原录音已损毁，仅存转写文字。讲的是窑温控制、耐火砖配比——冶铁炉膛的前置手艺。',
    // 原片已遗失，所以没有 sizeBytes；时长按转写最后一句记
    durationSec: 90,
    tags: ['陶器', '耐火砖', '口述', '残卷'],
    contentHash: 'hash-audio-lost-0007',
    status: 'ready',
    ingestedAt: '2026-01-26T10:00:00Z',
    createdAt: '2026-01-26T09:40:00Z'
  }
]

/** Mock 转写（视频"钻木取火"与音频"冶铁口述"的带时间戳文本片段） */
export const mockTranscripts: Transcript[] = [
  {
    carrierId: 'c-video-fire',
    language: 'zh',
    rawText:
      '今天演示三种取火方法。第一种钻木取火，需要干燥的硬木和软木底座，快速旋转产生摩擦热。',
    segments: [
      { startSec: 0, endSec: 15, text: '今天演示三种取火方法。' },
      { startSec: 15, endSec: 45, text: '第一种钻木取火，需要干燥的硬木和软木底座。' },
      { startSec: 45, endSec: 90, text: '快速旋转产生摩擦热，火星落到火绒上。' }
    ]
  },
  {
    carrierId: 'c-audio-iron',
    language: 'zh',
    rawText:
      '鼓风炉的火候很关键，木炭要烧透。铁矿石要选含铁量高的，砸碎之后和木炭一层一层铺进炉里。淬火的时候，烧红的铁放进水里，表面会变硬。回火之后，铁刃才不会一碰就断。',
    segments: [
      { startSec: 0, endSec: 30, text: '鼓风炉的火候很关键，木炭要烧透。' },
      { startSec: 30, endSec: 70, text: '铁矿石要选含铁量高的，砸碎之后和木炭一层一层铺进炉里。' },
      {
        startSec: 70,
        endSec: 120,
        text: '淬火的时候，烧红的铁放进水里，表面会变硬。回火之后，铁刃才不会一碰就断。'
      }
    ]
  },
  {
    carrierId: 'c-audio-lost',
    language: 'zh',
    rawText:
      '窑要一点点烧起来，急火会把坯子烧裂。耐火砖用熟料和粘土，七分熟料三分粘土，掺水不能多。砖要阴干半个月，急不得。',
    segments: [
      { startSec: 0, endSec: 35, text: '窑要一点点烧起来，急火会把坯子烧裂。' },
      { startSec: 35, endSec: 65, text: '耐火砖用熟料和粘土，七分熟料三分粘土，掺水不能多。' },
      { startSec: 65, endSec: 90, text: '砖要阴干半个月，急不得。' }
    ]
  }
]
