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
import {
  readProject, Flags, isGithubRef, getGithubAuth, authPersister, inBrowser, makeIncluder,
  getRuntimeForAction
} from '@nimbella/nimbella-deployer'

import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
export class ProjectMetadata extends NimBaseCommand {
  static description = 'Obtain metadata of a Nimbella project'

  static flags = {
    env: flags.string({ description: 'Path to environment file' }),
    include: flags.string({ description: 'Project portions to include' }),
    exclude: flags.string({ description: 'Project portions to exclude' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'project', description: 'The project whose metadata is requested', required: true }]

  async runCommand(_rawArgv: string[], _argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    const project = args.project
    const isGithub = isGithubRef(project)
    const { env, include, exclude } = flags
    if (inBrowser && !isGithub) {
      logger.handleError('only GitHub projects are accessible from the cloud')
    }
    if (isGithub && !flags['anon-github'] && !getGithubAuth(authPersister)) {
      logger.handleError('you don\'t have GitHub authorization.  Use \'nim auth github\' to activate it.')
    }
    const cmdFlags: Flags = {
      verboseBuild: false,
      verboseZip: false,
      production: false,
      incremental: false,
      env,
      buildEnv: undefined,
      yarn: false,
      include,
      exclude,
      remoteBuild: false,
      webLocal: undefined,
      json: true // output will always be JSON
    }
    this.debug('cmdFlags', cmdFlags)
    // Convert include/exclude flags into an Includer object
    const includer = makeIncluder(flags.include, flags.exclude)

    // Read the project
    const result = await readProject(args.project, env, undefined, includer, false, undefined, {})
    if (result.error && !result.unresolvedVariables) {
      logger.handleError('  ', result.error)
    }

    // Fill in any missing runtimes
    if (result.packages && !result.unresolvedVariables) {
      // Too dangerous to attempt this if the parse wasn't perfect
      for (const pkg of result.packages) {
        if (pkg.actions) {
          for (const action of pkg.actions) {
            action.runtime = await getRuntimeForAction(action, result.reader, {})
          }
        }
      }
    }

    // Display result
    logger.logJSON(result)
  }
}

export default ProjectMetadata
