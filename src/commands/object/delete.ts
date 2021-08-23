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
import { getObjectStorageClient } from '../../storage/clients'

export default class ObjectDelete extends NimBaseCommand {
    static description = 'Deletes Object from the Object Store'

    static flags = {
      namespace: flags.string({ description: 'The namespace to delete the object from (current namespace if omitted)' }),
      apihost: flags.string({ description: 'API host of the namespace to delete object from' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'objectName', description: 'The object to be deleted', required: true },
      { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      const { client } = await getObjectStorageClient(args, flags, authPersister)
      if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`)
      await this.deleteFile(args.objectName, client, logger).catch((err: Error) => logger.handleError('', err))
    }

    private async deleteFile(objectName: string, client: StorageClient, _logger: NimLogger) {
      const loader = await spinner()
      loader.start(`searching ${objectName}`, 'deleting', { stdout: true })
      await client.file(objectName).delete().then(_ => loader.stop('done'))
    }
}
