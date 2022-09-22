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
  readAndPrepare, buildProject, deploy, Flags, OWOptions, DeployResponse, Credentials, getCredentialsForNamespace,
  isGithubRef, authPersister, inBrowser, getGithubAuth, deleteSlice, initRuntimes, RuntimesConfig
} from '@nimbella/nimbella-deployer'

import {
  NimBaseCommand, NimLogger, NimFeedback, parseAPIHost, disambiguateNamespace, CaptureLogger,
  replaceErrors, branding
} from '../../NimBaseCommand'
import * as path from 'path'
import { choicePrompter } from '../../ui'
export class ProjectDeploy extends NimBaseCommand {
  static description = `Deploy ${branding.brand} projects`

  static flags = {
    target: flags.string({ description: 'The target namespace' }),
    env: flags.string({ description: 'Path to runtime environment file' }),
    'build-env': flags.string({ description: 'Path to build-time environment file' }),
    apihost: flags.string({ description: 'API host to use' }),
    auth: flags.string({ description: 'OpenWhisk auth token to use' }),
    insecure: flags.boolean({ description: 'Ignore SSL Certificates', default: false }),
    'verbose-build': flags.boolean({ description: 'Display build details' }),
    'verbose-zip': flags.boolean({ description: 'Display start/end of zipping phase for each action' }),
    production: flags.boolean({ description: 'Deploy to the production namespace instead of the test one' }),
    yarn: flags.boolean({ description: 'Use yarn instead of npm for node builds' }),
    'web-local': flags.string({ description: 'A local directory to receive web deploy, instead of uploading' }),
    include: flags.string({ description: 'Project portions to include' }),
    exclude: flags.string({ description: 'Project portions to exclude' }),
    'remote-build': flags.boolean({ description: 'Run builds remotely' }),
    incremental: flags.boolean({ description: 'Deploy only changes since last deploy' }),
    'anon-github': flags.boolean({ description: 'Attempt GitHub deploys anonymously' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'projects', description: 'One or more paths to projects' }]
  static strict = false

  async runCommand(_rawArgv: string[], argv: string[], _args: any, flags: any, logger: NimLogger): Promise<void> {
    // If no projects specified, display help
    if (argv.length === 0) {
      this.doHelp()
    }
    // Otherwise ...
    const isGithub = argv.some(project => isGithubRef(project))
    const multiple = argv.length > 1
    const { target, env, apihost, auth, insecure, production, yarn, incremental, include, exclude, json } = flags
    if (incremental && isGithub) {
      logger.handleError('\'--incremental\' may not be used with GitHub projects')
    }
    if (inBrowser && !isGithub) {
      logger.handleError('only GitHub projects are deployable from the cloud')
    }
    if (isGithub && !flags['anon-github'] && !getGithubAuth(authPersister)) {
      logger.handleError(`you don't have GitHub authorization.  Use '${branding.cmdName} auth github' to activate it.`)
    }
    if (multiple && json) {
      logger.handleError('the --json flag may not be used when deploying multiple projects')
    }
    const cmdFlags: Flags = {
      verboseBuild: flags['verbose-build'],
      verboseZip: flags['verbose-zip'],
      production,
      incremental,
      env,
      buildEnv: flags['build-env'],
      yarn,
      webLocal: flags['web-local'],
      include,
      exclude,
      remoteBuild: flags['remote-build'],
      json
    }
    this.debug('cmdFlags', cmdFlags)
    const { creds, owOptions } = await processCredentials(insecure, apihost, auth, target, logger)
    this.debug('creds', creds)

    // Deploy each project
    let success = true
    for (const project of argv) {
      if (multiple) {
        logger.log(`\nReading project '${project}`)
      }
      success = success && await doDeploy(project, cmdFlags, creds, owOptions, false, logger)
    }
    if (!success) {
      logger.exit(1)
    }
  }
}

// Functions also used by 'project watch'

// Process credentials, possibly select non-current namespace
export async function processCredentials(ignore_certs: boolean, apihost: string|undefined, auth: string|undefined,
  target: string|undefined, logger: NimLogger): Promise<{ creds: Credentials|undefined, owOptions: OWOptions }> {
  const owOptions: OWOptions = { ignore_certs } // No explicit undefined
  if (apihost) {
    owOptions.apihost = parseAPIHost(apihost)
  }
  if (auth) {
    owOptions.api_key = auth
  }
  // Iff a namespace switch was requested, perform it.  It might fail if there are no credentials for the target
  let creds: Credentials|undefined
  if (target) {
    [target] = (await disambiguateNamespace(target, owOptions.apihost, choicePrompter).catch((err: Error) => logger.handleError('', err))).split(' on ')
    creds = await getCredentialsForNamespace(target, owOptions.apihost, authPersister).catch((err: Error) => logger.handleError('', err))
  } else if (apihost && auth) {
    // For backward compatibility with `wsk`, we accept the absence of target when both apihost and auth are
    // provided on the command line.  We synthesize credentials with (as yet) unknown namespace; if it later
    // turns out that the creds conflict with a targetNamespace in the config, an error will be indicated then.
    creds = { namespace: undefined, ow: owOptions, storageKey: undefined, redis: false }
  } /* else undefined creds; this isn't necessarily an error since the config might supply a namespace via targetNamespace */
  return { creds, owOptions }
}

// Deploy one project
export async function doDeploy(project: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions, watching: boolean,
  logger: NimLogger): Promise<boolean> {
  let feedback: NimFeedback
  if (project.startsWith('slice:') || cmdFlags.json) {
    feedback = new NimFeedback(new CaptureLogger())
    feedback.warnOnly = true
  } else {
    feedback = new NimFeedback(logger)
  }

  let runtimes: RuntimesConfig
  try {
    runtimes = await initRuntimes()
  } catch (err) {
    logger.handleError('Failed to retrieve runtimes.json from platform host.', err)
  }

  let todeploy = await readAndPrepare(project, owOptions, creds, authPersister, cmdFlags, runtimes, undefined, feedback)
  if (!todeploy) {
    return false
  } else if (todeploy.error && !cmdFlags.json) {
    logger.displayError('', todeploy.error)
    return false
  }
  if (!watching && !todeploy.slice && !cmdFlags.json) {
    displayHeader(project, todeploy.credentials, logger)
  }
  todeploy = await buildProject(todeploy, runtimes)
  if (todeploy.error && !cmdFlags.json) {
    logger.displayError('', todeploy.error)
    return false
  }
  const result: DeployResponse = await deploy(todeploy)
  if (cmdFlags.json || todeploy.slice) {
    const success = displayJSONResult(result, logger, feedback, todeploy.slice)
    if (success && todeploy.slice) {
      await deleteSlice(todeploy)
    }
    return success
  }
  const bucketURL = todeploy.bucketClient?.getURL()
  return displayResult(result, watching, cmdFlags.webLocal, bucketURL, logger)
}

// Display the deployment "header" (what we are about to deploy)
function displayHeader(project: string, creds: Credentials, logger: NimLogger) {
  let namespaceClause = ''
  if (creds && creds.namespace) {
    namespaceClause = `\n  to namespace '${creds.namespace}'`
  }
  let hostClause = ''
  if (creds && creds.ow.apihost) {
    hostClause = `\n  on host '${creds.ow.apihost}'`
  }
  const projectPath = isGithubRef(project) ? project : path.resolve(project)
  logger.log(`Deploying '${projectPath}'${namespaceClause}${hostClause}`)
}

// Display the result of a successful run when deploying a slice or when JSON is requested.
// The output should be the DeployResponse as JSON on a single line, combined with the Feedback transcript if any
function displayJSONResult(outcome: DeployResponse, logger: NimLogger, feedback: any, slice: boolean): boolean {
  const transcript = feedback.logger.captured
  const result = { transcript, outcome }
  if (slice) {
    // Not using logJSON here because we need single-line output.
    // This is executing in a builder action anyway ... doesn't matter how output is produced.
    const toDisplay = JSON.stringify(result, replaceErrors)
    logger.log(toDisplay)
  } else {
    // Normal JSON, print normally with indentation
    logger.logJSON(result)
  }
  return outcome.failures.length === 0
}

// Display the result of a successful run
function displayResult(result: DeployResponse, watching: boolean, webLocal: string, bucketURL: string, logger: NimLogger): boolean {
  let success = true
  if (result.successes.length === 0 && result.failures.length === 0) {
    logger.log('\nNothing deployed')
  } else {
    logger.log('')
    const actions: string[] = []
    const triggers: string[] = []
    let deployedWeb = 0
    let skippedActions = 0
    let skippedWeb = 0
    let skippedTriggers = 0
    for (const success of result.successes) {
      if (success.kind === 'web') {
        if (success.skipped) {
          skippedWeb++
        } else {
          deployedWeb++
        }
      } else if (success.kind === 'action') {
        if (success.skipped) {
          skippedActions++
        } else {
          let name = success.name
          if (success.wrapping) {
            name += ` (wrapping ${success.wrapping})`
          }
          actions.push(name)
        }
      } else if (success.kind === 'trigger') {
        if (success.skipped) {
          skippedTriggers++
        } else {
          triggers.push(success.name)
        }
      }
    }
    if (deployedWeb > 0) {
      let bucketClause = ''
      if (webLocal) {
        bucketClause = ` to ${webLocal}`
      } else if (result.apihost) {
        bucketClause = ` to\n  ${bucketURL}`
      }
      logger.log(`Deployed ${deployedWeb} web content items${bucketClause}`)
    }
    if (skippedWeb > 0) {
      let bucketClause = ''
      if (watching && result.apihost) {
        if (webLocal) {
          bucketClause = ` in ${webLocal}`
        } else {
          bucketClause = ` on\n ${bucketURL}`
        }
      }
      logger.log(`Skipped ${skippedWeb} unchanged web resources${bucketClause}`)
    }
    if (actions.length > 0) {
      logger.log(branding.deployedActionsHeader)
      for (const action of actions) {
        logger.log(`  - ${action}`)
      }
    }
    if (skippedActions > 0) {
      logger.log(`Skipped ${skippedActions} unchanged actions`)
    }
    if (triggers.length > 0) {
      logger.log('Deployed triggers:')
      for (const trigger of triggers) {
        logger.log(`  - ${trigger}`)
      }
    }
    if (skippedTriggers > 0) {
      logger.log(`Skipped ${skippedTriggers} triggers`)
    }
    if (result.failures.length > 0) {
      success = false
      logger.log('Failures:')
      for (const err of result.failures) {
        success = false
        const context = (err as any).context
        if (context) {
          logger.displayError(`While deploying ${context}`, err)
        } else {
          logger.displayError('', err)
        }
      }
    }
  }
  return success
}

export default ProjectDeploy
