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
import { getPostmanKeys, deletePostmanKey, switchPostmanKey, addPostmanKey, getPostmanCurrentKey, authPersister } from 'nimbella-deployer'


export default class AuthPostman extends NimBaseCommand {
  static description = 'Manage Postman API Keys'

  static flags = {
    add: flags.boolean({ char: 'a', description: 'Add a Postman API key' }),
    delete: flags.string({ char: 'd', description: 'Forget a previously added Postman API key' }),
    list: flags.boolean({ char: 'l', description: 'List previously added Postman API keys' }),
    show: flags.string({ description: 'Show the Postman API key associated with given name' }),
    current: flags.boolean({ char: 'c', description: 'Show current Postman API key' }),
    switch: flags.string({ char: 's', description: 'Switch to using a particular previously added Postman API key' }),
    name: flags.string({ description: 'The Postman Key Name' }),
    key: flags.string({ description: 'The Postman API Key' }),
    ...NimBaseCommand.flags
  }

  static args = []
  static strict = false

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const flagCount = [flags.add, flags.switch, flags.list, flags.delete, flags.show, flags.current].filter(Boolean).length
    if (flagCount > 1) {
      logger.handleError(`only one of '--add', '--list', '--switch', '--delete', '--show', or '--current' may be specified`)
    } else if (!flags.add && (flags.key || flags.name)) {
      logger.handleError(`--name and --key may not be combined with other than --add flag`)
    } else if (flags.key && !flags.name || flags.name && !flags.key) {
      logger.handleError(`--name and --key must both be specified if either one is specified`)
    }
    if (flags.switch) {
      await this.doSwitch(flags.switch, logger)
    } else if (flags.list) {
      await this.doList(logger)
    } else if (flags.key && flags.name) {
      await this.doAdd(logger, flags.name, flags.key)
    } else if (flags.delete) {
      await this.doDelete(flags.delete, logger)
    } else if (flags.show) {
      await this.doShow(flags.show, logger)
    }
    else if (flags.current) {
      await this.showCurrent(logger)
    }
    else {
      this.doHelp()
    }
  }

  // Add a postman key.  Called for --add with combination --name + --key
  async doAdd(logger: NimLogger, name: string, key: string) {
    await addPostmanKey(name, key, authPersister)
    logger.log(`the postman key with name '${name}' was added and is now current`)
  }

  async doSwitch(name: string, logger: NimLogger) {
    const status = await switchPostmanKey(name, authPersister)
    if (status) {
      logger.log(`the postman key with name '${name}' is now current`)
    } else {
      logger.handleError(`${name} is not a previously added postman key`)
    }
  }

  async doList(logger: NimLogger) {
    const keys = await getPostmanKeys(authPersister)
    this.debug('keys: %O', keys)
    const keyNames = Object.keys(keys)
    this.debug('keyNames: %O', keyNames)
    if (keyNames.length > 0) {
      const list = keyNames.join(', ')
      logger.log(`previously added postman keys: ${list}`)
    } else {
      logger.log(`no previously added postman keys`)
    }
  }

  async doShow(name: string, logger: NimLogger) {
    const keys = await getPostmanKeys(authPersister)
    if (keys[name]) {
      logger.log(keys[name])
    } else {
      logger.handleError(`${name} is not a previously added postman key`)
    }
  }

  async showCurrent(logger: NimLogger) {
    const key = await getPostmanCurrentKey(authPersister)
    if (key) {
      logger.log(key)
    } else {
      logger.handleError(`there is no current key`)
    }
  }

  async doDelete(name: string, logger: NimLogger) {
    const status = await deletePostmanKey(name, authPersister)
    switch (status) {
      case "DeletedOk":
        logger.log(`the postman key with name '${name}' is removed from the credential store`)
        break
      case "DeletedDangling":
        logger.log(`the postman key with name '${name}' is removed from the credential store`)
        logger.log(`'${name}' was the current key; use 'nim auth postman [ --add | --switch ] to establish a new one`)
        break
      case "NotExists":
        logger.handleError(`${name} does not denote a previously added postman key`)
        break
    }
  }
}
