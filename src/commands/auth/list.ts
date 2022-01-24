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
import { getCredentialDict, authPersister, CredentialRow } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger, parseAPIHost, branding } from '../../NimBaseCommand'

import { bold } from 'chalk'

// Constants used in formatting the credential list
const LIST_HEADER = '  Namespace            Current File-Store   Key-Val Production Project'
const NS_LEN = 21
const YES = '   yes  '
const NO = '    no  '
const MAYBE = '   -?-  '

export default class AuthList extends NimBaseCommand {
  static description = `List all your ${branding.brand} namespaces`

  static flags = {
    apihost: flags.string({ description: 'Only list namespaces for the specified API host' }),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    const dict = await getCredentialDict(authPersister)
    let host: string
    if (flags.apihost) {
      host = parseAPIHost(flags.apihost)
      if (!(host in dict)) {
        logger.handleError(`No credentials for API host ${host}`)
      }
    }
    // We respect the --json flag here, but, because of the multi-part nature of the output when there is more than
    // one API host being reported, we won't use logTable but rather,
    //   - if JSON is requested, return a map from API host to CredentialRow, either for all hosts or just one
    //   - if JSON is not requested, format the table the traditional way using the code already here
    if (flags.json) {
      if (host) {
        const subDict = {}
        subDict[host] = dict[host]
        logger.logJSON(subDict)
      } else {
        const toLog = Object.entries(dict).filter(([_, rows]) => rows.length > 0)
        logger.logJSON(Object.fromEntries(toLog))
      }
      return
    }
    // Non-JSON output
    if (host) {
      logger.log(`${bold(`On API host ${host}:`)}`)
      await this.formatCredentialList(dict[host], logger)
    } else {
      if (Object.keys(dict).length === 1) {
        await this.formatCredentialList(Object.values(dict)[0], logger)
      } else {
        let newline = false
        for (const host in dict) {
          const rows = dict[host]
          if (rows.length === 0) continue
          if (newline) logger.log('')
          logger.log(`${bold(`On API host ${host}:`)}`)
          await this.formatCredentialList(rows, logger)
          newline = true
        }
      }
    }
  }

  private async formatCredentialList(credentialList: CredentialRow[], logger: NimLogger) {
    logger.log(bold(LIST_HEADER))
    for (const row of credentialList) {
      let ns = row.namespace
      let pad = ''
      if (ns.length < NS_LEN) {
        pad = ' '.repeat(NS_LEN - ns.length)
      } else {
        ns = ns.slice(0, NS_LEN - 3) + '...'
      }
      const check = row.current ? (process && process.platform === 'win32' ? '\u221A ' : '\u2713 ') : '  '
      const curr = row.current ? YES : NO
      const stor = row.storage ? YES : NO
      const redis = row.redis ? YES : row.redis === false ? NO : MAYBE
      const production = row.production ? YES : NO
      const owner = row.project || '<any>'
      logger.log(check + ns + pad + curr + stor + '    ' + redis + production + '     ' + owner)
    }
  }
}
