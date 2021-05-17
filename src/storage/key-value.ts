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

import { getCredentials, getCredentialsForNamespace, Credentials } from '@nimbella/nimbella-deployer'

import openwhisk from 'openwhisk'
const systemNamespace = 'nimbella'

export async function queryKVStore(query: string, args: any, flags: any, authPersister: any): Promise<openwhisk.Dict> {
  let namespace = flags.namespace
  let creds: Credentials
  if (!namespace) {
    creds = await getCredentials(authPersister)
    namespace = creds.namespace
  } else {
    creds = await getCredentialsForNamespace(namespace, flags.apihost, authPersister)
  }
  if (!creds) { return }
  if (!creds.redis) { throw new Error('Key-Value Store not enabled for namespace: ' + namespace) }
  const ow = openwhisk(creds.ow)
  return ow.actions.invoke({ name: `/${systemNamespace}/${query}`, blocking: true, result: true, params: args })
}
