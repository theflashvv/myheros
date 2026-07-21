import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.resolve('data/game_config.json')

function load() { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
function save(data) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8') }

export function register(server) {

  server.tool('battle_get_config', '读取战斗配置（等级上限、暴击倍率、派生属性公式等）', {},
    async () => {
      const config = load()
      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] }
    }
  )

  server.tool('battle_update_config', '修改战斗配置参数', {
    field: z.string().describe('字段路径，如 "crit.physical_multiplier" 或 "level.max"'),
    value: z.any().describe('新值'),
  },
    async ({ field, value }) => {
      const config = load()
      const keys = field.split('.')
      let obj = config
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] === undefined) obj[keys[i]] = {}
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
      save(config)
      return { content: [{ type: 'text', text: `✅ 战斗配置 ${field} 已更新为 ${JSON.stringify(value)}` }] }
    }
  )
}
