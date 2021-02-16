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

import { NimBaseCommand, NimLogger, Flags, Credentials, OWOptions, inBrowser, isGithubRef, delay, getExclusionList } from 'nimbella-deployer'
import { ProjectDeploy, processCredentials, doDeploy } from './deploy'

import * as fs from 'fs'
import * as chokidar from 'chokidar'
import * as path from 'path'

export default class ProjectWatch extends NimBaseCommand {
  static description = 'Watch Nimbella projects, deploying incrementally on change'

  static flags: any = {
    target: ProjectDeploy.flags.target,
    env: ProjectDeploy.flags.env,
    apihost: ProjectDeploy.flags.apihost,
    auth: ProjectDeploy.flags.auth,
    insecure: ProjectDeploy.flags.insecure,
    'verbose-build': ProjectDeploy.flags['verbose-build'],
    'verbose-zip': ProjectDeploy.flags['verbose-zip'],
    yarn: ProjectDeploy.flags.yarn,
    'web-local': ProjectDeploy.flags['web-local'],
    include: ProjectDeploy.flags.include,
    exclude: ProjectDeploy.flags.exclude,
    'remote-build': ProjectDeploy.flags['remote-build'],
    ...NimBaseCommand.flags
  }

  static args = ProjectDeploy.args
  static strict = false

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    // If no projects specified, display help
    if (argv.length === 0) {
      this.doHelp()
    }
    // In the cloud, disallow the command entirely (it can't possibly work and it's easiest to head it off here)
    if (inBrowser) {
      logger.handleError('\'project watch\' is designed for local development and will not work in the cloud')
    }
    // Otherwise ...
    const isGithub = argv.some(project => isGithubRef(project))
    if (isGithub && !flags['anon-github']) {
      logger.handleError('you don\'t have github authorization.  Use \'nim auth github --initial\' to activate it.')
    }
    const { target, env, apihost, auth, insecure, yarn, include, exclude } = flags
    const cmdFlags: Flags = {
      verboseBuild: flags['verbose-build'],
      verboseZip: flags.verboseZip,
      production: false,
      incremental: true,
      env,
      yarn,
      webLocal: flags['web-local'],
      include,
      exclude,
      remoteBuild: flags['remote-build']
    }
    this.debug('cmdFlags', cmdFlags)
    const { creds, owOptions } = await processCredentials(insecure, apihost, auth, target, logger)
    argv.forEach(project => watch(project, cmdFlags, creds, owOptions, logger))
  }
}

// Validate a project and start watching it if it actually looks like a project
function watch(project: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions,
  logger: NimLogger) {
  const msg = validateProject(project)
  if (msg) {
    logger.handleError(msg, new Error(msg))
  }
  logger.log(`Watching '${project}' [use Control-C to terminate]`)
  let watcher: chokidar.FSWatcher
  const reset = async() => {
    if (watcher) {
      // logger.log("Closing watcher")
      await watcher.close()
    }
  }
  const watch = () => {
    // logger.log("Opening new watcher")
    watcher = chokidar.watch(project, { ignoreInitial: true, followSymlinks: false, usePolling: false, useFsEvents: false, ignored: getExclusionList(project) })
    watcher.on('all', async(event, filename) => await fireDeploy(project, filename, cmdFlags, creds, owOptions, logger, reset, watch, event))
  }
  watch()
}

// Fire a deploy cycle.  Suspends the watcher so that mods made to the project by the deployer won't cause a spurious re-trigger.
// TODO this logic was crafted for fs.watch().  There might be a better way to suspend chokidar.
// Displays an informative message before deploying.
async function fireDeploy(project: string, filename: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions,
  logger: NimLogger, reset: ()=>Promise<void>, watch: ()=>void, event: string) {
  if (event === 'addDir') {
    // Don't fire on directory add ... it never represents a complete change.
    return
  }
  await reset()
  logger.log(`\nDeploying '${project}' due to change in '${filename}'`)
  let error = false
  const result = await doDeploy(project, cmdFlags, creds, owOptions, true, logger).catch(err => {
    logger.displayError('', err)
    error = true
  })
  if (error || !result) { return }
  logger.log('Deployment complete.  Resuming watch.\n')
  await delay(200).then(() => watch())
}

// Validate a project argument to ensure that it denotes an actual directory that "looks like a project".
// Returns an error message when there is a problem, undefined otherwise
function validateProject(project: string): string|undefined {
  if (isGithubRef(project)) {
    return `'${project}' is not in the local file system; we do not support watching github projects`
  }
  if (!fs.existsSync(project)) {
    return `${project} does not exist`
  }
  const stat = fs.lstatSync(project)
  if (!stat.isDirectory()) {
    return `${project} is not a directory`
  }
  if (isTypicalProject(project, 'project.yml', true) || isTypicalProject(project, 'packages', false) ||
            isTypicalProject(project, 'web', false)) {
    return undefined
  }
  return `${project} is a directory but it doesn't appear to contain a project`
}

// Check for typical things found in a project (part of validating that a directory is a project)
function isTypicalProject(project: string, item: string, shouldBeFile: boolean): boolean {
  item = path.join(project, item)
  if (fs.existsSync(item)) {
    const stat = fs.lstatSync(item)
    if ((shouldBeFile && stat.isFile()) || (!shouldBeFile && stat.isDirectory())) {
      return true
    }
  }
  return false
}
