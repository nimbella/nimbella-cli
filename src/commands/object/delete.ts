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
import { NimBaseCommand, NimLogger, StorageClient } from 'nimbella-deployer'
import { authPersister } from 'nimbella-deployer'
import { getObjectStorageClient } from '../../storage/clients'

export default class ObjectDelete extends NimBaseCommand {
    static description = 'Deletes Object from the Object Store'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to delete object from' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'objectName', description: 'The object to be deleted', required: true },
        { name: 'namespace', description: 'The namespace to delete object from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.deleteFile(args.objectName, client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async deleteFile(objectName: string, client: StorageClient, logger: NimLogger) {
        const loader = await spinner();
        loader.start(`searching ${objectName}`, 'deleting', { stdout: true })
        await client.file(objectName).delete().then(_ => loader.stop('done'));
    }
}
