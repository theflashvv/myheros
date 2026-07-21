import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const ITEMS_FILE = path.resolve('data/items.json')
const SAVE_FILE  = path.resolve('data/player_save.json')
const SLOTS = ['weapon','offhand','head','chest','legs','accessory']

function loadItems() { return JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8')) }
function loadSave()  { return JSON.parse(fs.readFileSync(SAVE_FILE,  'utf8')) }
function saveItems(d) { fs.writeFileSync(ITEMS_FILE, JSON.stringify(d, null, 2), 'utf8') }
function saveSave(d)  { fs.writeFileSync(SAVE_FILE,  JSON.stringify(d, null, 2), 'utf8') }

export function register(server) {

  server.tool('equipment_list', '列出所有装备（可按槽位或稀有度过滤）', {
    slot:   z.enum(['weapon','offhand','head','chest','legs','accessory','all']).optional().default('all'),
    rarity: z.enum(['common','rare','epic','all']).optional().default('all'),
  },
    async ({ slot = 'all', rarity = 'all' }) => {
      const { items } = loadItems()
      let list = items
      if (slot   !== 'all') list = list.filter(i => i.slot === slot)
      if (rarity !== 'all') list = list.filter(i => i.rarity === rarity)
      const lines = list.map(i => {
        const stats = Object.entries(i.stats || {}).map(([k,v]) => `${k}+${v}`).join(' ')
        return `• ${i.id} — ${i.name}（${i.slot}/${i.rarity}）${stats ? ' [' + stats + ']' : ''}`
      })
      return { content: [{ type: 'text', text: `共 ${list.length} 件装备：\n${lines.join('\n')}` }] }
    }
  )

  server.tool('equipment_get', '读取单件装备详情', {
    id: z.string().describe('装备ID'),
  },
    async ({ id }) => {
      const { items } = loadItems()
      const item = items.find(i => i.id === id)
      if (!item) return { content: [{ type: 'text', text: `❌ 装备 "${id}" 不存在` }] }
      return { content: [{ type: 'text', text: JSON.stringify(item, null, 2) }] }
    }
  )

  server.tool('equipment_add', '新增装备', {
    id:          z.string().describe('装备唯一ID'),
    name:        z.string().describe('装备名称'),
    slot:        z.enum(['weapon','offhand','head','chest','legs','accessory']).describe('装备槽位'),
    rarity:      z.enum(['common','rare','epic']).describe('稀有度'),
    description: z.string().describe('装备描述'),
    stats:       z.record(z.number()).optional().describe('属性加成，如 {"attack":10,"hp":30}'),
  },
    async ({ id, name, slot, rarity, description, stats }) => {
      const data = loadItems()
      if (data.items.find(i => i.id === id)) {
        return { content: [{ type: 'text', text: `❌ 装备 "${id}" 已存在` }] }
      }
      data.items.push({
        id, name, slot, rarity, description,
        stats: stats ?? {},
        percent_stats: {},
        special_effects: [],
        skill_grant: null,
        type_restriction: [],
        equippable_by: [],
      })
      saveItems(data)
      return { content: [{ type: 'text', text: `✅ 装备「${name}」（${id}）已添加` }] }
    }
  )

  server.tool('equipment_equip', '给角色装备或卸下某槽位道具', {
    character_id: z.string().describe('角色ID'),
    slot:         z.enum(['weapon','offhand','head','chest','legs','accessory']).describe('槽位'),
    item_id:      z.string().nullable().describe('装备ID，传 null 表示卸下'),
  },
    async ({ character_id, slot, item_id }) => {
      if (item_id !== null) {
        const { items } = loadItems()
        if (!items.find(i => i.id === item_id)) {
          return { content: [{ type: 'text', text: `❌ 装备 "${item_id}" 不存在` }] }
        }
      }
      const save = loadSave()
      if (!save.equipped[character_id]) {
        save.equipped[character_id] = Object.fromEntries(SLOTS.map(s => [s, null]))
      }
      save.equipped[character_id][slot] = item_id
      saveSave(save)
      const action = item_id ? `装备了「${item_id}」` : '卸下了装备'
      return { content: [{ type: 'text', text: `✅ ${character_id} 的 ${slot} 槽位${action}` }] }
    }
  )

  server.tool('equipment_get_loadout', '查看角色当前全部装备', {
    character_id: z.string().describe('角色ID'),
  },
    async ({ character_id }) => {
      const save  = loadSave()
      const { items } = loadItems()
      const equipped = save.equipped[character_id]
      if (!equipped) return { content: [{ type: 'text', text: `❌ 角色 "${character_id}" 没有装备记录` }] }
      const lines = SLOTS.map(slot => {
        const itemId = equipped[slot]
        const item   = itemId ? items.find(i => i.id === itemId) : null
        return `${slot.padEnd(9)}: ${item ? item.name + '（' + itemId + '）' : '— 空 —'}`
      })
      return { content: [{ type: 'text', text: `${character_id} 的装备：\n${lines.join('\n')}` }] }
    }
  )
}
