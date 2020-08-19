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

import { Bucket } from '@google-cloud/storage'
import { flags } from '@oclif/command'
import { basename, isAbsolute, join } from 'path'
import { existsSync, lstatSync } from 'fs'
import { spinner } from '../../ui'
import { NimBaseCommand, NimLogger } from 'nimbella-deployer'
import { authPersister } from 'nimbella-deployer'
import { getObjectStorageClient } from '../../storage/clients'

export default class ObjectCreate extends NimBaseCommand {
    static description = 'Adds Object to the Object Store'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to add object to' }),
        destination: flags.string({ char: 'd', description: 'Target location in object storage' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'objectPath', description: 'The object to be added', required: true },
        { name: 'namespace', description: 'The namespace to add object to (current namespace if omitted)', required: false }
    ]

    static aliases = ['objects:add', 'object:add']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister)
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`)
        await this.uploadFile(args.objectPath, flags.destination, client, logger).catch((err: Error) => logger.handleError('', err))
    }

    async uploadFile(objectPath: string, destination: string, client: Bucket, logger: NimLogger) {
        if (!existsSync(objectPath)) {
            logger.log(`${objectPath} doesn't exist`)
            return
        }
        if (!lstatSync(objectPath).isFile()) {
            logger.log(`${objectPath} is not a valid file`)
            return
        }
        const objectName = basename(objectPath)

        let targetPath = objectPath
        if (isAbsolute(objectPath)) targetPath = objectName
        if (destination) {
            if (destination.endsWith('/'))
                targetPath = join(destination, objectName)
            else
                targetPath = destination
        }

        const loader = await spinner()

        const [exists] = await client.file(targetPath).exists()
        if (exists) {
            logger.log(`${targetPath} already exists, use 'object:update' to update it. e.g. nim object update ${objectName}`)
            return
        }

        loader.start(`adding ${objectName}`, 'uploading', { stdout: true })
        await client.upload(objectPath, {
            destination: targetPath,
            gzip: true,
        }).then(_ => loader.stop('done'))
    }
}
