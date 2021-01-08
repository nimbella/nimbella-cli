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
import { NimBaseCommand, NimLogger, StorageClient } from 'nimbella-deployer'
import { authPersister } from 'nimbella-deployer'
import { getWebStorageClient } from '../../storage/clients'
import { fileMetaLong, fileMetaShort } from '../../storage/util'

export default class WebList extends NimBaseCommand {
    static description = 'Lists Web Content'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to list web content from' }),
        long: flags.boolean({ char: 'l', description: 'Displays additional file info such as last update, owner and md5hash' }),
        namespace: flags.string({ description: 'The namespace to list web content from (current namespace if omitted)' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'prefix', description: 'Prefix to match the content against', required: false, default: '' }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getWebStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${flags.namespace || 'current'} namespace`);
        await this.listFiles(client, logger, flags.long, args.prefix).catch((err: Error) => logger.handleError('', err));
    }

    async listFiles(client: StorageClient, logger: NimLogger, isLongFormat: boolean, prefix: string): Promise<void> {
        const files = await client.getFiles({
            prefix: prefix,
        });
        if (files.length === 0) { return logger.log(`No content available ${prefix ? `matching prefix '${prefix}'` : ''}`); }
        if (isLongFormat) {
            await fileMetaLong(files, client, logger).catch(err => logger.handleError(err))
        }
        else {
            await fileMetaShort(files, client, logger).catch(err => logger.handleError(err))
        }
    }
}
