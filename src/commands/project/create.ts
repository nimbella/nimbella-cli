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
import { NimBaseCommand, NimLogger } from 'nimbella-deployer'
import { inBrowser } from 'nimbella-deployer'
import { createOrUpdateProject } from '../../generator/project'

const plugins = ['postman', 'openapi']
export default class ProjectCreate extends NimBaseCommand {
    static description = 'Create a Nimbella Project'

    static flags = {
        config: flags.boolean({ description: 'Generate template config file' }),
        source: flags.string({
            char: 's', description: 'API specs source',
            options: plugins
        }),
        id: flags.string({ char: 'i', description: 'API specs id/name/path' }),
        key: flags.string({ char: 'k', dependsOn: ['source'], description: 'Key to access the source API' }),
        language: flags.string({
            char: 'l', description: 'Language for the project (creates sample project unless source is specified)', default: 'js',
            options: ['go', 'js', 'ts', 'py', 'java', 'swift', 'php']
        }),
        overwrite: flags.boolean({ char: 'o', description: 'Overwrites the existing file(s)', }),
        updateSource: flags.boolean({ char: 'u', description: 'Sync updated API specs back to source' }),
        clientCode: flags.boolean({ char: 'c', description: 'Generates client code', default: true }),

        ...NimBaseCommand.flags
    }

    static args = [{ name: 'name', description: 'Project name', required: false }]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!args.name && !flags.source) {
            this.doHelp()
        }
        if (inBrowser) {
            logger.handleError(`'project create' needs local file access. Use the 'nim' CLI on your local machine`)
        }
        if (flags.source) {
            const params = ['-i', flags.id || '', '-k', flags.key || '', '-l', flags.language];
            if (flags.overwrite) { params.push('-o'); }
            if (flags.updateSource) { params.push('-u'); }
            if (flags.clientCode) { params.push('-c'); }
            const pluginCommands = this.config.commands.filter(c => c.pluginName === flags.source);
            if (pluginCommands.length) {
                await pluginCommands[0].load().run([...params])
            }
            else {
                logger.handleError(`the ${flags.source} plugin is not installed. try 'nim plugins add ${flags.source}'`);
            }
        }
        else {
            await createOrUpdateProject(false, args, flags, logger)
        }
    }
}
