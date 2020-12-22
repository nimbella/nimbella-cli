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

import { NimLogger, StorageClient } from 'nimbella-deployer'
import { bold } from 'chalk'

// Constants used in formatting the file list
const SIZE_LEN = 10
const LIST_SHORT_HEADER = 'Name'
const LIST_LONG_HEADER = `Size${' '.repeat(SIZE_LEN - 4)} Updated${' '.repeat(17)} Name`
const MAYBE = '-?-'

export async function fileMetaShort(files: any, _client: StorageClient, logger: NimLogger): Promise<void> {
  logger.log(bold(LIST_SHORT_HEADER))
  for (const file of files) {
    logger.log(`${file.name}`)
  }
}

export async function fileMetaLong(files: any, client: StorageClient, logger: NimLogger): Promise<void> {
  logger.log(bold(LIST_LONG_HEADER))
  for (const file of files) {
    const meta = await client.file(file.name).getMetadata()
    const fileName = meta.name
    let sizePad = ''
    const size = humanFileSize(meta.size)
    if (size.length < SIZE_LEN) {
      sizePad = ' '.repeat(SIZE_LEN - size.length)
    }
    const updated = meta.updated || MAYBE
    logger.log(`${size}${sizePad} ${updated} ${fileName}`)
  }
}

export function humanFileSize(bytes: number | undefined, si: boolean | undefined = undefined): string {
  if (!bytes) return
  const thresh = si ? 1000 : 1024
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B'
  }
  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  let u = -1
  do {
    bytes /= thresh
    ++u
  } while (Math.abs(bytes) >= thresh && u < units.length - 1)
  return bytes.toFixed(1) + ' ' + units[u]
}

export function errorHandler(err: any, logger: NimLogger, fileName: string): void {
  if (err.code === 'CONTENT_DOWNLOAD_MISMATCH') {
    logger.log(`${fileName} content is not printable on prompt.`)
  } else if (err.code === 404) {
    logger.log(`${fileName} is not available.`)
  } else { logger.handleError(err.message) }
}
