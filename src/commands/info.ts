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
import { NimBaseCommand, NimLogger, parseAPIHost, wskRequest, RuntimeTable, inBrowser, authPersister, getCredentials } from '@nimbella/nimbella-deployer'
import { open } from '../ui'

export default class Info extends NimBaseCommand {
  static description = "Show information about this version of 'nim'"

  static flags = {
    license: flags.boolean({ description: 'Display the license', hidden: inBrowser }),
    changes: flags.boolean({ description: 'Display the change history', hidden: inBrowser }),
    runtimes: flags.boolean({ description: 'List the supported runtimes' }),
    limits: flags.boolean({ description: 'List the applicable Nimbella system limits' }),
    apihost: flags.string({ description: 'API host to query for runtimes and limits (ignored otherwise)', hidden: true }),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    if (flags.license && !inBrowser) {
      await this.displayAncillary('license', logger)
    } else if (flags.changes && !inBrowser) {
      await this.displayAncillary('changes', logger)
    } else if (flags.runtimes || flags.limits) {
      const sysinfo = await this.getSystemInfo(flags.apihost, logger)
      if (flags.runtimes) {
        this.displayRuntimes(sysinfo, logger)
      } else {
        this.displayLimits(sysinfo, logger)
      }
    } else {
      // We want the version to include a githash.  Versions taken from package.json will have one if they were installed
      // via an update "channel" and these also have the advantage of including a channel name.  However, "stable" versions
      // taken from package.json are just a semver.  In that case, we try to take the version from a separate version.json file.
      // That file is not guaranteed to be present.
      let vj, pj
      try {
        vj = require('../../version.json')
      } catch {
        // Do nothing
      }
      try {
        pj = require('../../package.json')
      } catch {
        // Do nothing
      }
      const cli = pj?.version?.includes('-') ? pj : (vj || pj)
      const aio = require('@adobe/aio-cli-plugin-runtime/package.json')
      logger.log(`Nimbella CLI version: ${cli.version}`)
      logger.log(`Adobe I/O version:    ${aio.version}`)
      if (!inBrowser) {
        logger.log("'nim info --license' to display the license")
        logger.log("'nim info --changes' to display the change history")
      }
      logger.log("'nim info --runtimes' to display the supported runtimes")
      logger.log("'nim info --limits' to display the limits")
    }
  }

  // Display an HTML file in the default browser (these commands are disabled in the workbench, not because they couldn't work there but
  // because the information they display is either available in another form ('license') or is misleading ('changes'))
  async displayAncillary(topic: string, logger: NimLogger): Promise<void> {
    try {
      const html = require.resolve(`../../${topic}.html`)
      await open(html)
    } catch (err) {
      logger.displayError('', err)
      logger.log(`Packaging error: cannot locate ${topic}`)
    }
  }

  // Display the runtimes in a vaguely tabular format
  async displayRuntimes(sysinfo: Record<string, any>, logger: NimLogger): Promise<void> {
    // Organize the information for display
    const rawDisplay: string[][] = []
    const runtimes = sysinfo.runtimes as RuntimeTable
    for (const language in runtimes) {
      for (const entry of runtimes[language]) {
        rawDisplay.push([language, entry.kind, entry.default ? '(default)' : ''])
      }
    }
    // Format for display
    const maxLanguage: number = rawDisplay.reduce((prev, curr) => curr[0].length > prev ? curr[0].length : prev, 0)
    const maxKind = rawDisplay.reduce((prev, curr) => curr[1].length > prev ? curr[1].length : prev, 0)
    const display: string[] = rawDisplay.map(entry => entry[0].padEnd(maxLanguage + 1, ' ') +
      entry[1].padEnd(maxKind + 1, ' ') + entry[2])
    // Display
    logger.log('Language'.padEnd(maxLanguage + 1, ' ') + 'Kind'.padEnd(maxKind + 1), ' ')
    for (const line of display.sort()) {
      logger.log(line)
    }
  }

  // Display the limits with a heuristic for units (works for the moment)
  async displayLimits(sysinfo: Record<string, any>, logger: NimLogger): Promise<void> {
    const limits = sysinfo.limits
    for (const limit in limits) {
      logger.log(`${limit}: ${this.formatUnits(limit, limits[limit])}`)
    }
  }

  // Convert a limit value into a more readable form using units inferred from the limit name
  formatUnits(limitName: string, limitValue: number): string {
    if (limitName.includes('duration')) {
      if (limitValue > 1000) {
        return (limitValue / 1000) + ' seconds'
      } else {
        return limitValue + ' ms'
      }
    } else if (limitName.includes('memory')) {
      return (limitValue / (1024 * 1024)) + ' mb'
    } else if (limitName.includes('logs')) {
      return (limitValue / 1024 + ' kb')
    } else {
      return String(limitValue)
    }
  }

  async getSystemInfo(apihost: string, logger: NimLogger): Promise<any> {
    if (apihost) {
      apihost = parseAPIHost(apihost)
    } else {
      const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
      apihost = creds.ow.apihost
    }
    const url = apihost + '/api/v1'
    return await wskRequest(url, undefined).catch(err => logger.handleError('', err))
  }
}
