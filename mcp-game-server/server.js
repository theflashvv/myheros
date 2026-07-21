import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { register as registerCharacter } from './modules/character.js'
import { register as registerSkill }     from './modules/skill.js'
import { register as registerEquipment } from './modules/equipment.js'
import { register as registerMap }       from './modules/map.js'
import { register as registerQuest }     from './modules/quest.js'
import { register as registerDialogue }  from './modules/dialogue.js'
import { register as registerBattle }    from './modules/battle.js'

const server = new McpServer({
  name: 'my-heroes-game-server',
  version: '2.0.0',
})

registerCharacter(server)
registerSkill(server)
registerEquipment(server)
registerMap(server)
registerQuest(server)
registerDialogue(server)
registerBattle(server)

const transport = new StdioServerTransport()
await server.connect(transport)
