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

import { flags } from '@oclif/command'
import { NimBaseCommand, NimLogger, inBrowser } from 'nimbella-deployer'

import { createOrUpdateProject } from '../../generator/project'

export default class ProjectCreate extends NimBaseCommand {
  static strict = false
  static description = 'Create a Nimbella Project'
  static plugins = { postman: 'ppm', openapi: 'poa', sample: 'sample' }

  static flags = {
    config: flags.boolean({ description: 'Generate template config file' }),
    type: flags.string({
      char: 't',
      description: 'API specs source',
      options: Object.keys(ProjectCreate.plugins)
    }),
    language: flags.string({
      char: 'l',
      description: 'Language for the project (creates sample project unless source is specified)',
        options: ['go', 'golang', 'js', 'javascript', 'ts', 'typescript', 'py', 'python', 'java', 'swift', 'php'],
        default: 'js'
    }),
    overwrite: flags.boolean({ char: 'o', description: 'Overwrites the existing file(s)' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'project', description: 'project path in the file system', required: false }]

  getCommand = (type: string): any => {
    const pluginCommands = this.config.commands.filter(c => c.pluginName.endsWith(type))
    if (pluginCommands.length) {
      const pluginCommand = pluginCommands.filter(c => c.id === ProjectCreate.plugins[type])
      return pluginCommand[0]
    }
  }

  async init():Promise<any> {
    const { flags } = this.parse(ProjectCreate)
    ProjectCreate.flags = Object.assign(ProjectCreate.flags, (this.getCommand(flags.type) || '').flags)
  }

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger):Promise<any> {
    if (!args.project && !flags.type) {
      this.doHelp()
    }
    if (inBrowser) {
      logger.handleError('\'project create\' needs local file access. Use the \'nim\' CLI on your local machine')
    }
    if (flags.type && flags.type === 'sample') {
      args.project = args.project || flags.type
      await createOrUpdateProject(false, args, flags, logger)
    } else if (flags.type) {
      const command = this.getCommand(flags.type)
      if (command) {
        await command.load().run(rawArgv)
      } else {
        logger.handleError(`the ${flags.type} plugin is not installed. try 'nim plugins add ${flags.type}'`)
      }
    } else {
      await createOrUpdateProject(false, args, flags, logger)
    }
  }
}
