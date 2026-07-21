import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const CHARS_FILE = path.resolve('data/characters.json')

function load() {
  return JSON.parse(fs.readFileSync(CHARS_FILE, 'utf8'))
}

function save(data) {
  fs.writeFileSync(CHARS_FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function register(server) {

  server.tool('character_list', '列出所有角色', {
    type: z.enum(['playable','npc','all']).optional().default('all').describe('过滤类型：playable=可战斗角色 npc=剧情NPC all=全部'),
  },
    async ({ type = 'all' }) => {
      const { characters } = load()
      const list = type === 'all' ? characters : characters.filter(c => (c.type ?? 'playable') === type)
      const lines = list.map(c => `• ${c.id} — ${c.name}（${c.role}）[${c.type ?? 'playable'}]`)
      return { content: [{ type: 'text', text: `共 ${list.length} 名角色：\n${lines.join('\n')}` }] }
    }
  )

  server.tool('character_get', '读取单个角色完整数据', {
    id: z.string().describe('角色ID'),
  },
    async ({ id }) => {
      const { characters } = load()
      const c = characters.find(c => c.id === id)
      if (!c) return { content: [{ type: 'text', text: `❌ 角色 "${id}" 不存在` }] }
      return { content: [{ type: 'text', text: JSON.stringify(c, null, 2) }] }
    }
  )

  server.tool('character_add', '新增角色', {
    id:          z.string().describe('角色唯一ID'),
    name:        z.string().describe('中文名'),
    name_en:     z.string().describe('英文名'),
    series:      z.string().describe('所属系列'),
    role:        z.string().describe('职业定位，如"魔法师 / 辅助"'),
    description: z.string().describe('角色介绍'),
    type:        z.enum(['playable','npc']).optional().default('playable').describe('角色类型：playable=可战斗角色（默认） npc=剧情NPC'),
    portrait:    z.string().optional().describe('立绘路径，如 assets/portraits/xxx.png'),
    hp:          z.number().int().optional().describe('HP（npc可不填）'),
    mp:          z.number().int().optional().describe('MP（npc可不填）'),
    attack:      z.number().int().optional().describe('攻击（npc可不填）'),
    defense:     z.number().int().optional().describe('防御（npc可不填）'),
    magic_defense: z.number().int().optional().describe('魔防（npc可不填）'),
    speed:       z.number().int().optional().describe('速度（npc可不填）'),
    agility:     z.number().int().optional().describe('敏捷（npc可不填）'),
    intelligence: z.number().int().optional().describe('智力（npc可不填）'),
    unique_name: z.string().optional().describe('专属指令名称（npc可不填）'),
    unique_desc: z.string().optional().describe('专属指令描述（npc可不填）'),
  },
    async ({ id, name, name_en, series, role, description, type = 'playable', portrait, hp, mp, attack, defense, magic_defense, speed, agility, intelligence, unique_name, unique_desc }) => {
      const data = load()
      if (data.characters.find(c => c.id === id)) {
        return { content: [{ type: 'text', text: `❌ 角色 "${id}" 已存在` }] }
      }
      const entry = { id, name, name_en, series, type, portrait: portrait ?? null, avatar: null, role, description }
      if (type === 'playable') {
        Object.assign(entry, {
          base_stats: { hp: hp??300, mp: mp??100, attack: attack??50, defense: defense??50, magic_defense: magic_defense??50, speed: speed??60, agility: agility??50, intelligence: intelligence??50 },
          growth_rates: { hp:20, mp:3, attack:2, defense:1, magic_defense:1, speed:1, agility:1, intelligence:2 },
          unique_command: { name: unique_name ?? '未命名', description: unique_desc ?? '—', type: 'unique' },
          skills: [],
          resistances: { fire:'normal', ice:'normal', wind:'normal', dark:'normal', holy:'normal', physical:'normal' },
          equipment_slots: ['weapon','offhand','head','chest','legs','accessory'],
        })
      }
      data.characters.push(entry)
      save(data)
      return { content: [{ type: 'text', text: `✅ ${type === 'npc' ? 'NPC' : '角色'}「${name}」（${id}）已添加，共 ${data.characters.length} 名角色` }] }
    }
  )

  server.tool('character_update', '修改角色字段', {
    id:    z.string().describe('角色ID'),
    field: z.string().describe('要修改的字段路径，如 "base_stats.attack" 或 "description"'),
    value: z.any().describe('新值'),
  },
    async ({ id, field, value }) => {
      const data = load()
      const c = data.characters.find(c => c.id === id)
      if (!c) return { content: [{ type: 'text', text: `❌ 角色 "${id}" 不存在` }] }
      const keys = field.split('.')
      let obj = c
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] === undefined) obj[keys[i]] = {}
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
      save(data)
      return { content: [{ type: 'text', text: `✅ ${c.name} 的 ${field} 已更新为 ${JSON.stringify(value)}` }] }
    }
  )

  server.tool('character_add_skill', '给角色学习表追加技能', {
    character_id: z.string().describe('角色ID'),
    level:        z.number().int().describe('学习等级'),
    skill_id:     z.string().describe('技能ID（需在 skills.json 中存在）'),
    name:         z.string().describe('技能名称'),
    type:         z.enum(['physical','magic','support','unique']).describe('技能类型'),
    mp_cost:      z.number().int().describe('MP消耗'),
    description:  z.string().describe('技能描述'),
  },
    async ({ character_id, level, skill_id, name, type, mp_cost, description }) => {
      const data = load()
      const c = data.characters.find(c => c.id === character_id)
      if (!c) return { content: [{ type: 'text', text: `❌ 角色 "${character_id}" 不存在` }] }
      c.skills = c.skills.filter(s => s.skill_id !== skill_id)
      c.skills.push({ level, skill_id, name, type, mp_cost, description })
      c.skills.sort((a, b) => a.level - b.level)
      save(data)
      return { content: [{ type: 'text', text: `✅ 已给「${c.name}」添加技能「${name}」（Lv.${level}）` }] }
    }
  )

  server.tool('character_set_personality', '设定或更新角色性格', {
    id:          z.string().describe('角色ID'),
    personality: z.string().describe('性格描述'),
  },
    async ({ id, personality }) => {
      const data = load()
      const c = data.characters.find(c => c.id === id)
      if (!c) return { content: [{ type: 'text', text: `❌ 角色 "${id}" 不存在` }] }
      c.personality = personality
      save(data)
      return { content: [{ type: 'text', text: `✅ 「${c.name}」的性格已设定` }] }
    }
  )
}
