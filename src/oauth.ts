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

import { OWOptions, wskRequest } from '@nimbella/nimbella-deployer'
import { NimLogger } from './NimBaseCommand'

import makeDebug from 'debug'
const debug = makeDebug('nim:oauth')

const NAMESPACE = 'nimbella'
const TOKENIZER = '/user/tokenizer'

// Compute the API url for a given namespace on a given host.   To this result, one typically appends
// /pkg/action in order to invoke a (web) action.  The form of URL used here is designed for the api
// ingress, not the bucket ingress.  We used to go to the trouble of using the bucket ingress; I'm
// not sure why.  In some on-prem deployments there will be no bucket ingress, hence the change.
function getAPIUrl(namespace: string, apihost: string): string {
  return `${apihost}/api/v1/web/${namespace}`
}

// Invoke the tokenizer given low level OW credentials (auth and apihost), getting back a bearer token to full credentials
export async function getCredentialsToken(ow: OWOptions, logger: NimLogger, nonExpiring = false): Promise<string> {
  debug('getCredentialsToken with input %O', ow)
  const url = getAPIUrl(NAMESPACE, ow.apihost) + TOKENIZER + (nonExpiring === true ? '?ttl=login' : '')
  let response
  try {
    response = await wskRequest(url, ow.api_key)
  } catch (err) {
    logger.handleError('', err)
  }
  debug('response from tokenizer: %O', response)
  return response.token
}
