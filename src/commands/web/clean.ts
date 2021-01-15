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
import { getWebStorageClient } from '../../storage/clients'
import { prompt } from '../../ui'
import { authPersister, restore404Page, OWOptions } from 'nimbella-deployer'

export default class WebContentClean extends NimBaseCommand {
    static description = 'Deletes all Content from Web Storage'

    static flags = {
        namespace: flags.string({ description: 'The namespace to clean (current namespace if omitted)' }),
        apihost: flags.string({ description: 'API host of the namespace to clean' }),
        force: flags.boolean({ char: 'f', description: 'Just do it, omitting confirmatory prompt' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!flags.force) {
            const ans = await prompt(`Type 'yes' to remove all content from web storage`);
            if (ans !== 'yes') {
                logger.log('Doing nothing.');
                return;
            }
        }
        const { client, creds } = await getWebStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.cleanup(client, creds.ow, logger).catch((err: Error) => logger.handleError('', err));
    }

    async cleanup(client: StorageClient, ow: OWOptions, logger: NimLogger) {
        const loader = await spinner();
        loader.start(`deleting web content`, '', { stdout: true })
        await client.deleteFiles().then(_ => restore404Page(client, ow)).then(_ => loader.stop('done')).catch(e => logger.handleError('', e));
    }
}
