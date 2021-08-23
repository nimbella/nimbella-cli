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
import { spinner } from '../../ui'
import { StorageClient, authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getWebStorageClient } from '../../storage/clients'

export default class WebContentDelete extends NimBaseCommand {
    static description = 'Deletes Content from the Web Storage'

    static flags = {
      namespace: flags.string({ description: 'The namespace in which to delete content (current namespace if omitted)' }),
      apihost: flags.string({ description: 'API host of the namespace in which to delete content' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'webContentName', description: 'The web content to be deleted', required: true },
      { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      const { client } = await getWebStorageClient(args, flags, authPersister)
      if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`)
      await this.deleteFile(args.webContentName, client, logger).catch((err: Error) => logger.handleError('', err))
    }

    private async deleteFile(webContentName: string, client: StorageClient, _logger: NimLogger) {
      const loader = await spinner()
      loader.start(`searching ${webContentName}`, 'deleting', { stdout: true })
      await client.file(webContentName).delete().then(_ => loader.stop('done'))
    }
}
