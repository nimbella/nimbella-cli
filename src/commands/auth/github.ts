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
import { getGithubAccounts, deleteGithubAccount, switchGithubAccount, addGithubAccount, authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { isGithubProvider, doOAuthFlow } from '../../oauth'

import { prompt } from '../../ui'

type AuthGithubStatus = 'AlreadyHave' | 'MadeCurrent' | 'Ok' | 'DeletedOk' | 'DeletedDangling'
interface AuthGithubResult {
  status: AuthGithubStatus
  replaced?: boolean
  accounts?: string[]
  messages?: string[]
  tokenValue?: string
}

export default class AuthGithub extends NimBaseCommand {
  static description = 'Manage GitHub accounts'

  static flags = {
    add: flags.boolean({ char: 'a', description: 'Add a second or subsequent GitHub account interactively' }),
    delete: flags.string({ char: 'd', description: 'Forget a previously added GitHub account' }),
    initial: flags.boolean({ char: 'i', description: 'Add an initial GitHub account interactively' }),
    list: flags.boolean({ char: 'l', description: 'List previously added GitHub accounts' }),
    show: flags.string({ description: 'Show the access token currently associated with a username' }),
    switch: flags.string({ char: 's', description: 'Switch to using a particular previously added GitHub account' }),
    token: flags.string({ description: 'The GitHub token when adding an account manually' }),
    username: flags.string({ description: 'The GitHub username when adding an account manually' }),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(_rawArgv: string[], _argv: string[], _args: any, flags: any, logger: NimLogger): Promise<void> {
    const flagCount = [flags.add, flags.initial, flags.switch, flags.list, flags.delete, flags.show].filter(Boolean).length
    if (flagCount > 1) {
      logger.handleError('only one of \'--add\', \'--initial\', \'--list\', \'--switch\', \'--delete\', or \'--show\' may be specified')
    } else if (flagCount === 1 && (flags.token || flags.username)) {
      logger.handleError('--token and --username may not be combined with other flags')
    } else if ((flags.token && !flags.username) || (flags.username && !flags.token)) {
      logger.handleError('--token and --username must both be specified if either one is specified')
    }
    let result: AuthGithubResult
    if (flags.switch) {
      result = await this.doSwitch(flags.switch, logger)
    } else if (flags.list) {
      result = await this.doList(logger)
    } else if (flags.add || flags.initial) {
      result = await this.doAdd(logger, flags.initial, undefined, undefined)
    } else if (flags.token && flags.username) {
      result = await this.doAdd(logger, false, flags.username, flags.token)
    } else if (flags.delete) {
      result = await this.doDelete(flags.delete, logger)
    } else if (flags.show) {
      result = await this.doShow(flags.show, logger)
    } else {
      this.doHelp()
      return
    }
    const msgs = result.messages || []
    delete result.messages
    logger.logOutput(result, msgs)
  }

  // Add a github credential.  Called for --add, --initial, and the combination --username + --token
  private async doAdd(logger: NimLogger, isInitial: boolean, name: string, token: string): Promise<AuthGithubResult> {
    if (name && token) {
      await addGithubAccount(name, token, authPersister)
    } else {
      const existing = await getGithubAccounts(authPersister)
      if (isInitial && Object.keys(existing).length > 0) {
        const list = Object.keys(existing).join(', ')
        return {
          status: 'AlreadyHave',
          messages: [`you already have GitHub credentials: ${list}`, 'Doing nothing.  Use "--add" if you really want to add more accounts']
        }
      } else {
        const authResponse = await doOAuthFlow(logger, true, undefined)
        if (isGithubProvider(authResponse)) {
          const warn = !isInitial && !!existing[authResponse.name]
          await addGithubAccount(authResponse.name, authResponse.key, authPersister)
          name = authResponse.name
          if (warn) {
            return { status: 'MadeCurrent', replaced: true, messages: [`You already had an entry for username '${authResponse.name}'.  It was replaced`] }
          }
        } else if (authResponse === true) {
          // We assume this happens only in the workbench; prompt should appear as placeholder text in the CLI pane
          await prompt('Workbench will restart with added GitHub credentials (please wait)')
          return { status: 'MadeCurrent' }
        } else {
          logger.handleError(`GitHub authentication failed, response was '${authResponse}'`)
        }
      }
    }
    return { status: 'MadeCurrent', messages: [`the GitHub account of user name '${name}' was added and is now current`] }
  }

  private async doSwitch(name: string, logger: NimLogger): Promise<AuthGithubResult> {
    const status = await switchGithubAccount(name, authPersister)
    if (status) {
      return { status: 'MadeCurrent', messages: [`the GitHub account of user name '${name}' is now current`] }
    } else {
      logger.handleError(`${name} is not a previously added GitHub account`)
    }
  }

  private async doList(_logger: NimLogger): Promise<AuthGithubResult> {
    const accounts = await getGithubAccounts(authPersister)
    this.debug('accounts: %O', accounts)
    const accountNames = Object.keys(accounts)
    this.debug('accountNames: %O', accountNames)
    let msg = 'no previously added GitHub accounts'
    if (accountNames.length > 0) {
      const list = accountNames.join(', ')
      msg = `previously added GitHub accounts: ${list}`
    }
    return { status: 'Ok', accounts: accountNames, messages: [msg] }
  }

  private async doShow(name: string, logger: NimLogger): Promise<AuthGithubResult> {
    const accounts = await getGithubAccounts(authPersister)
    if (accounts[name]) {
      return { status: 'Ok', tokenValue: accounts[name], messages: [accounts[name]] }
    } else {
      logger.handleError(`${name} is not a previously added GitHub account`)
    }
  }

  private async doDelete(name: string, logger: NimLogger): Promise<AuthGithubResult> {
    const status = await deleteGithubAccount(name, authPersister)
    const messages = [`the GitHub account of user name '${name}' is removed from the credential store`]
    switch (status) {
    case 'DeletedOk':
      break
    case 'DeletedDangling':
      messages.push(`'${name}' was the current account; use 'nim auth github [ --add | --switch ] to establish a new one`)
      break
    case 'NotExists':
      logger.handleError(`${name} does not denote a previously added GitHub account`)
    }
    return { status, messages }
  }
}
