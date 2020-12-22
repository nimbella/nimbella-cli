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

import { StorageClient, getCredentials, getCredentialsForNamespace, computeBucketStorageName, 
  makeStorageClient, Credentials } from 'nimbella-deployer'

type StorageClientResponse = {
    bucketName: string
    client: StorageClient
    creds: Credentials
}
async function getStorageClient(args: any, flags: any, authPersister: any, bucketPrefix = ''): Promise<StorageClientResponse> {
  let namespace = flags.namespace
  let creds: Credentials
  let apiHost: string = flags.apihost
  if (!namespace) {
    creds = await getCredentials(authPersister)
    namespace = creds.namespace
  } else {
    creds = await getCredentialsForNamespace(namespace, flags.apihost, authPersister)
  }
  apiHost = creds.ow.apihost
  const storageKey = creds.storageKey
  const bucketName = computeBucketStorageName(apiHost, namespace)
  if (!storageKey) {
    return { bucketName, client: undefined, creds: undefined }
  }
  const client = makeStorageClient(bucketPrefix + bucketName, storageKey)
  return { bucketName, client, creds }
}

export async function getWebStorageClient(args: any, flags: any, authPersister: any): Promise<StorageClientResponse> {
  return await getStorageClient(args, flags, authPersister)
}

export async function getObjectStorageClient(args: any, flags: any, authPersister: any): Promise<StorageClientResponse> {
  return await getStorageClient(args, flags, authPersister, 'data-')
}
