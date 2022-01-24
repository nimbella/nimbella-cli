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

import { inBrowser } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger, branding } from '../../NimBaseCommand'
import { createOrUpdateProject, seemsToBeProject } from '../../generator/project'
import ProjectCreate from './create'
import { flags } from '@oclif/command'

const plugins = { postman: 'ppm', openapi: 'poa', sample: 'sample', apispecgen: 'pas' }
export default class ProjectUpdate extends NimBaseCommand {
  static description = `Update a ${branding.brand} Project`
  static strict = false
  static flags = Object.assign(
    ProjectCreate.flags,
    {
      config: flags.boolean({ description: 'Generate config file' })
    })

  static args = [{ name: 'project', description: 'project path in the file system', default: process.cwd(), required: false }]
  // For now:
  static hidden = true

  getCommand = (type: string): any => {
    const pluginCommands = this.config.commands.filter(c => c.pluginName.endsWith(type))
    if (pluginCommands.length) {
      const pluginCommand = pluginCommands.filter(c => c.id === plugins[type])
      return pluginCommand[0]
    }
  }

  async init(): Promise<any> {
    const { flags } = this.parse(ProjectUpdate)
    if (flags.type) { ProjectUpdate.flags = Object.assign(ProjectUpdate.flags, (this.getCommand(flags.type) || '').flags) }
  }

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<any> {
    if (!flags.type && !flags.config) {
      this.doHelp()
    }
    if (inBrowser) {
      logger.handleError(`'project update' needs local file access. Use the '${branding.cmdName}' CLI on your local machine`)
    }
    if (!seemsToBeProject(args.project)) {
      logger.handleError(`${args.project} doesn't appear to be a project`)
    }

    if (flags.config) {
      const configCommand = Object.keys(plugins)[3]
      const command = this.getCommand(configCommand)
      if (command) {
        await command.load().run(rawArgv)
      } else {
        logger.handleError(`the ${configCommand} plugin is not installed. try '${branding.cmdName} plugins add ${configCommand}'`)
      }
      return
    }

    if (flags.type) {
      const command = this.getCommand(flags.type)
      if (command) {
        await command.load().run(rawArgv)
      } else {
        logger.handleError(`the ${flags.type} plugin is not installed. try '${branding.cmdName} plugins add ${flags.type}'`)
      }
    } else {
      await createOrUpdateProject(true, args, flags, logger)
    }
  }
}
