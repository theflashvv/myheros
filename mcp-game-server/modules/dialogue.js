import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const DIALOGUES_FILE = path.resolve('data/dialogues.json')

function load() {
  if (!fs.existsSync(DIALOGUES_FILE)) fs.writeFileSync(DIALOGUES_FILE, JSON.stringify({ version:'1.0', dialogues:[] }, null, 2))
  return JSON.parse(fs.readFileSync(DIALOGUES_FILE, 'utf8'))
}
function save(data) { fs.writeFileSync(DIALOGUES_FILE, JSON.stringify(data, null, 2), 'utf8') }

export function register(server) {

  server.tool('dialogue_list', '列出所有对话组', {},
    async () => {
      const { dialogues } = load()
      if (!dialogues.length) return { content: [{ type: 'text', text: '暂无对话组' }] }
      const lines = dialogues.map(d => `• ${d.id} — ${d.title}（${d.lines.length} 行）`)
      return { content: [{ type: 'text', text: `共 ${dialogues.length} 组对话：\n${lines.join('\n')}` }] }
    }
  )

  server.tool('dialogue_get', '读取对话组详情', {
    id: z.string().describe('对话组ID'),
  },
    async ({ id }) => {
      const { dialogues } = load()
      const d = dialogues.find(d => d.id === id)
      if (!d) return { content: [{ type: 'text', text: `❌ 对话组 "${id}" 不存在` }] }
      const text = d.lines.map((l, i) => `[${i+1}] ${l.speaker}：${l.text}`).join('\n')
      return { content: [{ type: 'text', text: `【${d.title}】\n${text}` }] }
    }
  )

  server.tool('dialogue_add', '新增对话组', {
    id:    z.string().describe('对话组唯一ID'),
    title: z.string().describe('对话组标题/场景描述'),
    lines: z.array(z.object({
      speaker: z.string().describe('说话者名称'),
      text:    z.string().describe('对话内容'),
    })).describe('对话行列表'),
  },
    async ({ id, title, lines }) => {
      const data = load()
      if (data.dialogues.find(d => d.id === id)) return { content: [{ type: 'text', text: `❌ 对话组 "${id}" 已存在` }] }
      data.dialogues.push({ id, title, lines })
      save(data)
      return { content: [{ type: 'text', text: `✅ 对话组「${title}」已添加，共 ${lines.length} 行对话` }] }
    }
  )
}
