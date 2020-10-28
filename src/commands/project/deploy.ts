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
import { NimBaseCommand, NimLogger, NimFeedback, parseAPIHost, disambiguateNamespace, CaptureLogger,
  readAndPrepare, buildProject, deploy, Flags, OWOptions, DeployResponse, Credentials, getCredentialsForNamespace,
  computeBucketDomainName, isGithubRef, authPersister, inBrowser, getGithubAuth, deleteSlice } from 'nimbella-deployer';
import * as path from 'path'
import { choicePrompter } from '../../ui';

export class ProjectDeploy extends NimBaseCommand {
  static description = 'Deploy Nimbella projects'

  static flags = {
    target: flags.string({ description: 'The target namespace'}),
    env: flags.string({ description: 'Path to environment file' }),
    apihost: flags.string({ description: 'API host to use' }),
    auth: flags.string({ description: 'OpenWhisk auth token to use' }),
    insecure: flags.boolean({ description: 'Ignore SSL Certificates', default: false }),
    'verbose-build': flags.boolean({ description: 'Display build details' }),
    'verbose-zip': flags.boolean({ description: 'Display start/end of zipping phase for each action'}),
    production: flags.boolean({ description: 'Deploy to the production namespace instead of the test one' }),
    yarn: flags.boolean({ description: 'Use yarn instead of npm for node builds' }),
    'web-local': flags.string({ description: 'A local directory to receive web deploy, instead of uploading'}),
    include: flags.string({ description: 'Project portions to include' }),
    exclude: flags.string({ description: 'Project portions to exclude' }),
    'remote-build': flags.boolean({ description: 'Run builds remotely', hidden: true }),
    incremental: flags.boolean({ description: 'Deploy only changes since last deploy' }),
    'anon-github': flags.boolean({ description: 'Attempt GitHub deploys anonymously'} ),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'projects', description: 'One or more paths to projects'} ]
  static strict = false

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    // If no projects specified, display help
    if (argv.length == 0) {
      this.doHelp()
    }
    // Otherwise ...
    const isGithub = argv.some(project => isGithubRef(project))
    const { target, env, apihost, auth, insecure, production, yarn, incremental, include, exclude } = flags
    if (incremental && isGithub) {
      logger.handleError(`'--incremental' may not be used with GitHub projects`)
    }
    if (inBrowser && !isGithub) {
      logger.handleError(`only GitHub projects are deployable from the cloud`)
    }
    if (isGithub && !flags['anon-github'] && !getGithubAuth(authPersister)) {
      logger.handleError(`you don't have GitHub authorization.  Use 'nim auth github --initial' to activate it.`)
    }
    const cmdFlags: Flags = { verboseBuild: flags['verbose-build'], verboseZip: flags['verbose-zip'], production, incremental, env, yarn,
      webLocal: flags['web-local'], include, exclude, remoteBuild: flags['remote-build'] }
    this.debug('cmdFlags', cmdFlags)
    const { creds, owOptions } = await processCredentials(insecure, apihost, auth, target, logger)
    this.debug('creds', creds)

    // Deploy each project
    let success = true
    const multiple = argv.length > 1
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
  const owOptions: OWOptions = { ignore_certs }  // No explicit undefined
  if (apihost) {
    owOptions.apihost = parseAPIHost(apihost)
  }
  if (auth) {
    owOptions.api_key = auth
  }
  // Iff a namespace switch was requested, perform it.  It might fail if there are no credentials for the target
  let creds: Credentials|undefined = undefined
  if (target) {
    target = await disambiguateNamespace(target, owOptions.apihost, choicePrompter).catch((err: Error) => logger.handleError('', err))
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
  if (project.startsWith("slice:")) {
    feedback = new NimFeedback(new CaptureLogger())
    feedback.warnOnly = true
   } else {
     feedback = new NimFeedback(logger)
   }
  let todeploy = await readAndPrepare(project, owOptions, creds, authPersister, cmdFlags, undefined, feedback)
   if (!todeploy) {
    return false
  } else if (todeploy.error) {
      logger.displayError('', todeploy.error)
      return false
  }
  if (!watching && !todeploy.slice) {
    displayHeader(project, todeploy.credentials, logger)
  }
  todeploy = await buildProject(todeploy)
  if (todeploy.error) {
      logger.displayError('', todeploy.error)
      return false
  }
  const result: DeployResponse = await deploy(todeploy)
  if (todeploy.slice) {
    const success = displaySliceResult(result, logger, feedback)
    if (success) {
      await deleteSlice(todeploy)
    }
    return success
  }
  return displayResult(result, watching, cmdFlags.webLocal, logger)
}

// Display the deployment "header" (what we are about to deploy)
function displayHeader(project: string, creds: Credentials, logger: NimLogger) {
  let namespaceClause = ""
  if (creds && creds.namespace) {
      namespaceClause = `\n  to namespace '${creds.namespace}'`
  }
  let hostClause = ""
  if (creds && creds.ow.apihost) {
      hostClause = `\n  on host '${creds.ow.apihost}'`
  }
  const projectPath = isGithubRef(project) ? project : path.resolve(project)
  logger.log(`Deploying project '${projectPath}'${namespaceClause}${hostClause}`)
}

// Display the result of a successful run when deploying a slice
// The output should be the DeployResponse as JSON on a single line, combined with the Feedback transcript if any
function displaySliceResult(outcome: DeployResponse, logger: NimLogger, feedback: any): boolean {
  function replaceErrors(_key: string, value: any) {
    if (value instanceof Error) {
      const error = {};
      Object.getOwnPropertyNames(value).forEach(function (key) {
        error[key] = value[key];
      });
      return error;
    }
    return value;
  }
  const transcript = feedback.logger.captured
  const result = { transcript, outcome }
  const toDisplay = JSON.stringify(result, replaceErrors)
  logger.log(toDisplay)
  return outcome.failures.length === 0
}

// Display the result of a successful run
function displayResult(result: DeployResponse, watching: boolean, webLocal: string, logger: NimLogger): boolean {
  let success = true
  if (result.successes.length == 0 && result.failures.length == 0) {
      logger.log("\nNothing deployed")
  } else {
      logger.log('')
      const actions: string[] = []
      let deployedWeb = 0
      let skippedActions = 0
      let skippedWeb = 0
      for (const success of result.successes) {
          if (success.kind === 'web') {
              if (success.skipped) {
                  skippedWeb++
              } else {
                  deployedWeb++
              }
          } else if (success.kind == "action") {
              if (success.skipped) {
                  skippedActions++
              } else {
                  let name = success.name
                  if (success.wrapping) {
                      name += ` (wrapping ${success.wrapping})`
                  }
                  actions.push(name)
              }
          }
      }
      if (deployedWeb > 0) {
          let bucketClause = ""
          if (webLocal) {
            bucketClause = ` to ${webLocal}`
          } else if (result.apihost) {
              bucketClause = ` to\n  https://${computeBucketDomainName(result.apihost, result.namespace)}`
          }
          logger.log(`Deployed ${deployedWeb} web content items${bucketClause}`)
      }
      if (skippedWeb > 0) {
          let bucketClause = ""
          if (watching && result.apihost) {
              bucketClause = ` on\n  https://${computeBucketDomainName(result.apihost, result.namespace)}`
          }
          logger.log(`Skipped ${skippedWeb} unchanged web resources${bucketClause}`)
      }
      if (actions.length > 0) {
          logger.log(`Deployed actions ('nim action get <actionName> --url' for URL):`)
          for (const action of actions) {
              logger.log(`  - ${action}`)
          }
      }
      if (skippedActions > 0) {
          logger.log(`Skipped ${skippedActions} unchanged actions`)
      }
      if (result.failures.length > 0) {
          success = false
          logger.log('Failures:')
          for (const err of result.failures) {
              success = false
              const context = (err as any)['context']
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
