import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const MAPS_DIR = path.resolve('data/maps')
if (!fs.existsSync(MAPS_DIR)) fs.mkdirSync(MAPS_DIR, { recursive: true })

function mapPath(mapId) { return path.join(MAPS_DIR, `${mapId}.json`) }
function loadMap(mapId) {
  const p = mapPath(mapId)
  if (!fs.existsSync(p)) throw new Error(`地图 "${mapId}" 不存在`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
function saveMap(mapId, data) {
  data.updatedAt = new Date().toISOString()
  fs.writeFileSync(mapPath(mapId), JSON.stringify(data, null, 2), 'utf8')
}
function createEmptyMap(id, name, width, height, defaultTile = 0) {
  return {
    id, name, width, height,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tileLayer: Array.from({ length: height }, () => Array(width).fill(defaultTile)),
    tileset: {
      0:  { name:'草地',   passable:true,  symbol:'·' },
      1:  { name:'树木',   passable:false, symbol:'♣' },
      2:  { name:'水域',   passable:false, symbol:'≈' },
      3:  { name:'山地',   passable:false, symbol:'▲' },
      4:  { name:'道路',   passable:true,  symbol:'=' },
      5:  { name:'建筑',   passable:false, symbol:'■' },
      6:  { name:'沙地',   passable:true,  symbol:'~' },
      7:  { name:'洞穴',   passable:true,  symbol:'O' },
      8:  { name:'传送点', passable:true,  symbol:'✦' },
      9:  { name:'出入口', passable:true,  symbol:'D' },
    },
    npcs: [], events: [], encounters: [],
  }
}

export function register(server) {

  server.tool('create_map', '创建一张新地图（空白网格）', {
    id:           z.string().describe('地图唯一ID，如 "town_01" 或 "dungeon_cave"'),
    name:         z.string().describe('地图显示名称，如 "初始小镇"'),
    width:        z.number().int().min(5).max(200).describe('地图宽度（格数）'),
    height:       z.number().int().min(5).max(200).describe('地图高度（格数）'),
    default_tile: z.number().int().min(0).max(9).optional().describe('默认填充的图块ID（默认0=草地）'),
  },
    async ({ id, name, width, height, default_tile }) => {
      if (fs.existsSync(mapPath(id))) return { content: [{ type: 'text', text: `❌ 地图 "${id}" 已存在` }] }
      saveMap(id, createEmptyMap(id, name, width, height, default_tile ?? 0))
      return { content: [{ type: 'text', text: `✅ 地图 "${name}"（${id}）创建成功，尺寸：${width}×${height}` }] }
    }
  )

  server.tool('list_maps', '列出所有已存在的地图', {},
    async () => {
      const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json'))
      if (!files.length) return { content: [{ type: 'text', text: '📂 暂无地图，请使用 create_map 创建' }] }
      const list = files.map(f => {
        try {
          const m = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, f), 'utf8'))
          return `• ${m.id} — "${m.name}"  ${m.width}×${m.height}  NPC:${m.npcs.length} 事件:${m.events.length} 遭遇:${m.encounters.length}`
        } catch { return `• ${f}（读取失败）` }
      })
      return { content: [{ type: 'text', text: `📋 共 ${files.length} 张地图：\n${list.join('\n')}` }] }
    }
  )

  server.tool('get_map', '读取地图完整数据（含图块层、NPC、事件、遭遇）', {
    map_id:    z.string().describe('地图ID'),
    show_grid: z.boolean().optional().describe('是否展示ASCII网格预览（默认true）'),
  },
    async ({ map_id, show_grid = true }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      let grid = ''
      if (show_grid) {
        const ts = map.tileset
        grid = '\n\n地图预览（ASCII）：\n'
        grid += '  ' + Array.from({ length: map.width }, (_, i) => (i % 10).toString()).join('') + '\n'
        map.tileLayer.forEach((row, y) => {
          const npcRow = map.npcs.filter(n => n.y === y).reduce((a, n) => { a[n.x]='N'; return a }, {})
          const evtRow = map.events.filter(e => e.y === y).reduce((a, e) => { a[e.x]='E'; return a }, {})
          const rowStr = row.map((t, x) => evtRow[x] ?? npcRow[x] ?? (ts[t]?.symbol ?? '?')).join('')
          grid += `${String(y).padStart(2)} ${rowStr}\n`
        })
        grid += '（N=NPC E=事件 ✦=传送点 D=出入口）'
      }
      return { content: [{ type: 'text', text: `地图：${map.name}（${map.id}）\n尺寸：${map.width}×${map.height}\nNPC：${map.npcs.length} 个\n事件：${map.events.length} 个\n遭遇区：${map.encounters.length} 个\n更新：${map.updatedAt}` + grid }] }
    }
  )

  server.tool('get_map_summary', '获取地图的详细摘要（NPC列表、事件列表、遭遇区列表）', {
    map_id: z.string().describe('地图ID'),
  },
    async ({ map_id }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      const npcList = map.npcs.map(n => `  • [${n.id}] ${n.name} (${n.x},${n.y}) ${n.role}`).join('\n') || '  （无NPC）'
      const evtList = map.events.map(e => `  • [${e.id}] ${e.type} (${e.x},${e.y}) 触发:${e.trigger}`).join('\n') || '  （无事件）'
      const encList = map.encounters.map(e => `  • [${e.id}] (${e.x},${e.y}) ${e.width}×${e.height} 触发率${Math.round(e.encounter_rate*100)}%`).join('\n') || '  （无遭遇区）'
      return { content: [{ type: 'text', text: `═══ ${map.name}（${map.id}）${map.width}×${map.height} ═══\n\nNPC（${map.npcs.length}）：\n${npcList}\n\n事件（${map.events.length}）：\n${evtList}\n\n遭遇区（${map.encounters.length}）：\n${encList}` }] }
    }
  )

  server.tool('set_tiles', '在地图上设置图块（单格或矩形区域填充）', {
    map_id:  z.string().describe('地图ID'),
    tile_id: z.number().int().min(0).max(9).describe('图块ID：0=草地 1=树木 2=水域 3=山地 4=道路 5=建筑 6=沙地 7=洞穴 8=传送点 9=出入口'),
    x: z.number().int().min(0).describe('起始X坐标'),
    y: z.number().int().min(0).describe('起始Y坐标'),
    width:  z.number().int().min(1).optional().describe('填充宽度（默认1）'),
    height: z.number().int().min(1).optional().describe('填充高度（默认1）'),
  },
    async ({ map_id, tile_id, x, y, width = 1, height = 1 }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      let count = 0
      for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
        const tx = x+dx, ty = y+dy
        if (ty >= 0 && ty < map.height && tx >= 0 && tx < map.width) { map.tileLayer[ty][tx] = tile_id; count++ }
      }
      saveMap(map_id, map)
      return { content: [{ type: 'text', text: `✅ 已将 ${count} 格设为「${map.tileset[tile_id]?.name ?? tile_id}」` }] }
    }
  )

  server.tool('place_npc', '在地图上放置一个NPC', {
    map_id:    z.string().describe('地图ID'),
    npc_id:    z.string().describe('NPC唯一ID'),
    name:      z.string().describe('NPC名称'),
    x:         z.number().int().min(0).describe('X坐标'),
    y:         z.number().int().min(0).describe('Y坐标'),
    direction: z.enum(['up','down','left','right']).optional().describe('NPC朝向（默认down）'),
    dialogues: z.array(z.string()).describe('对话内容列表'),
    role:      z.string().optional().describe('NPC角色类型：villager/merchant/quest/guard'),
  },
    async ({ map_id, npc_id, name, x, y, direction = 'down', dialogues, role = 'villager' }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      map.npcs = map.npcs.filter(n => n.id !== npc_id)
      map.npcs.push({ id: npc_id, name, x, y, direction, dialogues, role })
      saveMap(map_id, map)
      return { content: [{ type: 'text', text: `✅ NPC「${name}」已放置在 (${x}, ${y})` }] }
    }
  )

  server.tool('remove_npc', '从地图上移除一个NPC', {
    map_id: z.string().describe('地图ID'),
    npc_id: z.string().describe('NPC的ID'),
  },
    async ({ map_id, npc_id }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      const before = map.npcs.length
      map.npcs = map.npcs.filter(n => n.id !== npc_id)
      if (map.npcs.length === before) return { content: [{ type: 'text', text: `❌ 未找到NPC "${npc_id}"` }] }
      saveMap(map_id, map)
      return { content: [{ type: 'text', text: `✅ NPC "${npc_id}" 已移除` }] }
    }
  )

  server.tool('place_event', '在地图上放置一个事件触发器', {
    map_id:   z.string().describe('地图ID'),
    event_id: z.string().describe('事件唯一ID'),
    x:        z.number().int().min(0).describe('X坐标'),
    y:        z.number().int().min(0).describe('Y坐标'),
    type:     z.enum(['story','battle','treasure','teleport','heal','custom']).describe('事件类型'),
    trigger:  z.enum(['step','interact','auto']).optional().describe('触发方式（默认step）'),
    once:     z.boolean().optional().describe('是否只触发一次（默认true）'),
    data:     z.record(z.any()).describe('事件数据'),
  },
    async ({ map_id, event_id, x, y, type, trigger = 'step', once = true, data }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      map.events = map.events.filter(e => e.id !== event_id)
      map.events.push({ id: event_id, x, y, type, trigger, once, data })
      saveMap(map_id, map)
      return { content: [{ type: 'text', text: `✅ 事件「${event_id}」(${type}) 已放置在 (${x}, ${y})` }] }
    }
  )

  server.tool('remove_event', '从地图上移除一个事件触发器', {
    map_id:   z.string().describe('地图ID'),
    event_id: z.string().describe('事件ID'),
  },
    async ({ map_id, event_id }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      const before = map.events.length
      map.events = map.events.filter(e => e.id !== event_id)
      if (map.events.length === before) return { content: [{ type: 'text', text: `❌ 未找到事件 "${event_id}"` }] }
      saveMap(map_id, map)
      return { content: [{ type: 'text', text: `✅ 事件 "${event_id}" 已移除` }] }
    }
  )

  server.tool('place_encounter', '设置地图上的敌人遭遇区域', {
    map_id:         z.string().describe('地图ID'),
    encounter_id:   z.string().describe('遭遇区唯一ID'),
    x:              z.number().int().min(0).describe('区域左上角X'),
    y:              z.number().int().min(0).describe('区域左上角Y'),
    width:          z.number().int().min(1).describe('区域宽度'),
    height:         z.number().int().min(1).describe('区域高度'),
    encounter_rate: z.number().min(0).max(1).describe('每步触发概率（0.0~1.0）'),
    enemies:        z.array(z.object({ id: z.string(), weight: z.number() })).describe('敌人列表'),
    level_range:    z.object({ min: z.number(), max: z.number() }).optional().describe('敌人等级范围'),
  },
    async ({ map_id, encounter_id, x, y, width, height, encounter_rate, enemies, level_range }) => {
      let map; try { map = loadMap(map_id) } catch (e) { return { content: [{ type: 'text', text: `❌ ${e.message}` }] } }
      map.encounters = map.encounters.filter(e => e.id !== encounter_id)
      map.encounters.push({ id: encounter_id, x, y, width, height, encounter_rate, enemies, level_range: level_range ?? { min:1, max:10 } })
      saveMap(map_id, map)
      return { content: [{ type: 'text', text: `✅ 遭遇区「${encounter_id}」已设置，触发率：${Math.round(encounter_rate*100)}%` }] }
    }
  )

  server.tool('delete_map', '删除一张地图文件（不可恢复）', {
    map_id:  z.string().describe('要删除的地图ID'),
    confirm: z.literal('DELETE').describe('输入大写 DELETE 确认删除'),
  },
    async ({ map_id }) => {
      const p = mapPath(map_id)
      if (!fs.existsSync(p)) return { content: [{ type: 'text', text: `❌ 地图 "${map_id}" 不存在` }] }
      fs.unlinkSync(p)
      return { content: [{ type: 'text', text: `🗑️ 地图 "${map_id}" 已删除` }] }
    }
  )
}
