import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const QUESTS_FILE = path.resolve('data/quests.json')

function load() {
  if (!fs.existsSync(QUESTS_FILE)) fs.writeFileSync(QUESTS_FILE, JSON.stringify({ version:'1.0', quests:[] }, null, 2))
  return JSON.parse(fs.readFileSync(QUESTS_FILE, 'utf8'))
}
function save(data) { fs.writeFileSync(QUESTS_FILE, JSON.stringify(data, null, 2), 'utf8') }

export function register(server) {

  server.tool('quest_list', '列出所有任务', {},
    async () => {
      const { quests } = load()
      if (!quests.length) return { content: [{ type: 'text', text: '暂无任务' }] }
      const lines = quests.map(q => `• ${q.id} — ${q.title}（${q.status}）`)
      return { content: [{ type: 'text', text: `共 ${quests.length} 个任务：\n${lines.join('\n')}` }] }
    }
  )

  server.tool('quest_get', '读取任务详情', {
    id: z.string().describe('任务ID'),
  },
    async ({ id }) => {
      const { quests } = load()
      const q = quests.find(q => q.id === id)
      if (!q) return { content: [{ type: 'text', text: `❌ 任务 "${id}" 不存在` }] }
      return { content: [{ type: 'text', text: JSON.stringify(q, null, 2) }] }
    }
  )

  server.tool('quest_add', '新增任务定义', {
    id:          z.string().describe('任务唯一ID'),
    title:       z.string().describe('任务标题'),
    description: z.string().describe('任务描述'),
    giver:       z.string().optional().describe('任务发布者（NPC ID或名称）'),
    objectives:  z.array(z.string()).optional().describe('任务目标列表'),
    rewards:     z.array(z.string()).optional().describe('完成奖励列表'),
  },
    async ({ id, title, description, giver, objectives, rewards }) => {
      const data = load()
      if (data.quests.find(q => q.id === id)) return { content: [{ type: 'text', text: `❌ 任务 "${id}" 已存在` }] }
      data.quests.push({ id, title, description, giver: giver ?? null, objectives: objectives ?? [], rewards: rewards ?? [], status: 'inactive' })
      save(data)
      return { content: [{ type: 'text', text: `✅ 任务「${title}」已添加` }] }
    }
  )
}
