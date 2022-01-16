/*
 * Copyright (c) 2021 - present Joshua Auerbach
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

import { getCredentials, authPersister } from '@nimbella/nimbella-deployer'
import { StorageKey } from '@nimbella/storage'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { flags } from '@oclif/command'

// Theoretically, there is no guarantee that the following constants align with conventions in @nimbella/storage.
// In practice, IMO, it is safe to assume that these strings are "well-known" and cannot easily change.
const GCS_PROVIDER = '@nimbella/storage-gcs'
const S3_PROVIDER = '@nimbella/storage-s3'

export default class AuthEnv extends NimBaseCommand {
  static description = 'Print storage credentials in the form required in the environment of action runtimes'

  static args = []

  static flags = {
    quote: flags.boolean({ description: 'Escape and re-quote JSON to survive parsing by a shell' }),
    ...NimBaseCommand.flags
  }

  async runCommand(_rawArgv: string[], _argv: string[], _args: any, flags: any, logger: NimLogger): Promise<void> {
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const storage = creds.storageKey as StorageKey
    if (!storage) {
      logger.handleError('You do not have storage credentials ... doing nothing')
    }
    const namespace = creds.namespace
    const apiHost = creds.ow.apihost
    if (!namespace || !apiHost) {
      logger.handleError('Your current namespace lacks complete information ... doing nothing')
    }
    const output: Record<string, string> = {}
    const provider = storage.provider || GCS_PROVIDER
    if (provider === GCS_PROVIDER) {
      // The local storage form for this provider differs from what needs to be in the environment (historical).
      const { credentials, project_id } = storage
      const { client_email, private_key } = credentials
      addToOutput(output, '__NIM_STORAGE_KEY', JSON.stringify({ client_email, private_key, project_id }), flags.quote && !flags.json)
    } else if (provider === S3_PROVIDER) {
      // The S3 provider assumes what's in the environment === what would be stored.
      addToOutput(output, '__NIM_STORAGE_KEY', JSON.stringify(storage), flags.quote && !flags.json)
    } else {
      logger.handleError(`No support for storage provider '${provider}'`)
    }
    addToOutput(output, '__OW_NAMESPACE', namespace, false)
    addToOutput(output, '__OW_API_HOST', apiHost, false)
    if (flags.json) {
      logger.logJSON(output)
    } else {
      for (const key in output) {
        logger.log(`${key}=${output[key]}`)
      }
    }
  }
}

function escapeAndQuote(input: string): string {
  input = input.replace(/"/g, '\\"')
  return `"${input}"`
}

function addToOutput(output: Record<string, string>, key: string, value: string, quote: boolean) {
  if (quote) {
    value = escapeAndQuote(value)
  }
  output[key] = value
}
