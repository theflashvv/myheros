import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const SKILLS_FILE = path.resolve('data/skills.json')

function load() {
  return JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf8'))
}

function save(data) {
  fs.writeFileSync(SKILLS_FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function register(server) {

  server.tool('skill_list', '列出所有技能（可按类型或属性过滤）', {
    type:    z.enum(['physical','magic','support','heal','all']).optional().default('all').describe('技能类型过滤'),
    element: z.string().optional().describe('属性过滤，如 fire / ice / holy'),
  },
    async ({ type = 'all', element }) => {
      const { skills } = load()
      let list = skills
      if (type !== 'all') list = list.filter(s => s.type === type)
      if (element) list = list.filter(s => s.element === element)
      const lines = list.map(s => `• ${s.id} — ${s.name}（${s.type}${s.element ? '/' + s.element : ''}，威力:${s.base_power}，MP:${s.mp_cost}）`)
      return { content: [{ type: 'text', text: `共 ${list.length} 个技能：\n${lines.join('\n')}` }] }
    }
  )

  server.tool('skill_get', '读取单个技能详情', {
    id: z.string().describe('技能ID'),
  },
    async ({ id }) => {
      const { skills } = load()
      const s = skills.find(s => s.id === id)
      if (!s) return { content: [{ type: 'text', text: `❌ 技能 "${id}" 不存在` }] }
      return { content: [{ type: 'text', text: JSON.stringify(s, null, 2) }] }
    }
  )

  server.tool('skill_add', '新增技能定义', {
    id:          z.string().describe('技能唯一ID'),
    name:        z.string().describe('技能名称'),
    type:        z.enum(['physical','magic','support','heal']).describe('技能类型'),
    element:     z.string().nullable().optional().describe('属性（fire/ice/holy/dark/wind/water/null）'),
    target:      z.string().describe('目标范围：single/all_enemies/single_ally/all_allies/self/single_dead_ally'),
    base_power:  z.number().int().describe('基础威力（0=无伤害）'),
    mp_cost:     z.number().int().describe('MP消耗'),
    description: z.string().describe('技能说明'),
    extra:       z.record(z.any()).optional().describe('额外字段，如 {hits:3, healFlat:100, buffTurns:2}'),
  },
    async ({ id, name, type, element, target, base_power, mp_cost, description, extra }) => {
      const data = load()
      if (data.skills.find(s => s.id === id)) {
        return { content: [{ type: 'text', text: `❌ 技能 "${id}" 已存在` }] }
      }
      data.skills.push({ id, name, type, element: element ?? null, target, base_power, mp_cost, description, ...(extra ?? {}) })
      save(data)
      return { content: [{ type: 'text', text: `✅ 技能「${name}」（${id}）已添加` }] }
    }
  )

  server.tool('skill_update', '修改已有技能字段', {
    id:    z.string().describe('技能ID'),
    field: z.string().describe('要修改的字段名，如 "base_power" 或 "description"'),
    value: z.any().describe('新值'),
  },
    async ({ id, field, value }) => {
      const data = load()
      const s = data.skills.find(s => s.id === id)
      if (!s) return { content: [{ type: 'text', text: `❌ 技能 "${id}" 不存在` }] }
      s[field] = value
      save(data)
      return { content: [{ type: 'text', text: `✅ 技能「${s.name}」的 ${field} 已更新为 ${JSON.stringify(value)}` }] }
    }
  )
}
