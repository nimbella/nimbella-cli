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
import { inBrowser } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger, branding } from '../../NimBaseCommand'
import { createProject, languages } from '../../generator/project'

export default class ProjectCreate extends NimBaseCommand {
  static strict = false
  static description = `Create a ${branding.brand} Project`

  static flags = {
    config: flags.boolean({ description: 'Generate template config file (now the default)', hidden: true }),
    language: flags.string({
      char: 'l',
      description: 'Language for the project\'s initial sample',
      options: languages,
      default: 'js'
    }),
    overwrite: flags.boolean({ char: 'o', description: 'Overwrites the existing file(s)' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'project', description: 'project path in the file system', required: true }]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger):Promise<any> {
    if (inBrowser) {
      logger.handleError(`'project create' needs local file access. Use the '${branding.cmdName}' CLI on your local machine`)
    }
    await createProject(args.project, flags, logger)
  }
}
