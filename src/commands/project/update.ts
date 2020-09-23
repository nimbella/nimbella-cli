/*
 * Copyright (c) 2019 - present Nimbella Corp.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { NimBaseCommand, NimLogger, inBrowser } from 'nimbella-deployer'

import { createOrUpdateProject, seemsToBeProject } from '../../generator/project'
import ProjectCreate from './create'
import { flags } from '@oclif/command'

const confPlugin = 'apispecgen'
export default class ProjectUpdate extends NimBaseCommand {
  static description = 'Update a Nimbella Project'

  static flags = Object.assign(
    ProjectCreate.flags,
    {
      config: flags.boolean({ description: 'Generate config file' })
    })

  // For now:
  static hidden = true

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (!flags.source && !flags.config) {
      this.doHelp()
    }
    if (inBrowser) {
      logger.handleError('\'project update\' needs local file access. Use the \'nim\' CLI on your local machine')
    }
    if (!seemsToBeProject(process.cwd())) {
      logger.handleError('Current directory doesn\'t appear to be a project')
    }

    if (flags.config) {
      const pluginCommands = this.config.commands.filter(c => c.pluginName.endsWith(confPlugin))
      const params = []
      if (flags.overwrite) { params.push('-o') }
      if (pluginCommands.length) {
        await pluginCommands[0].load().run([...params])
      } else {
        logger.handleError(`the ${confPlugin} plugin is not installed. try 'nim plugins add ${confPlugin}'`)
      }
      return
    }

    if (flags.source) {
      const params = ['-i', flags.id || '', '-k', flags.key || '', '-l', flags.language, '--update']
      if (flags.overwrite) { params.push('-o') }
      if (flags.updateSource) { params.push('-u') }
      if (flags.clientCode) { params.push('-c') }
      const pluginCommands = this.config.commands.filter(c => c.pluginName.endsWith(flags.source))
      if (pluginCommands.length) {
        const pluginCommand = pluginCommands.filter(c => c.id === ProjectCreate.plugins[flags.source])
        await pluginCommand[0].load().run([...params])
      } else {
        logger.handleError(`the ${flags.source} plugin is not installed. try 'nim plugins add ${flags.source}'`)
      }
    } else {
      await createOrUpdateProject(true, args, flags, logger)
    }
  }
}
