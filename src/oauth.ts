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

import  * as querystring from 'querystring'
import { NimLogger} from 'nimbella-deployer'
import { OWOptions, wskRequest, inBrowser, FullCredentials, IdProvider } from 'nimbella-deployer'
import { open } from './ui'

import * as makeDebug from 'debug'
const debug = makeDebug('nim:oauth')

const DEFAULT_APIHOST = 'https://apigcp.nimbella.io'
const NAMESPACE = 'nimbella'
const TOKENIZER = '/user/tokenizer'
const LOGIN = '/user/login'
const PROGRESS = '/user/progress'

/**
 * Generates response card in the browser to instruct user to close browser/tag.
 * @param provider optional string for the provider name, may be empty string
 */
function loginHtml(provider?: string) {
    return `<html>
<head>
  <meta charset="utf-8"/>
  <style>
    html{font-family:sans-serif;background:#0e1e25}body{overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;width:100vw;}h3{margin:0}.card{position:relative;display:flex;flex-direction:column;width:75%;max-width:364px;padding:24px;background:white;color:rgb(14,30,37);border-radius:8px;box-shadow:0 2px 4px 0 rgba(14,30,37,.16);}
  </style>
</head>
<body>
  <div class='card'>
    <h3>Logged In</h3>
    <p>
      You're now logged into Nimbella CLI with your ${provider || ''} credentials. Please close this window.
    </p>
  </div>
</body></html>`
}

function provisioningHtml(loginUrl, progressUrl, id) {
    return `<html>
<head>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
        integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
  <style>
    html {
      font-family:sans-serif;
      background:#0e1e25;
    }
    body {
      overflow:hidden;position:relative;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;height:100vh;
      width:100vw;
      background:#0e1e25;
    }
    h3 {
      margin:0;
    }.card {
      position:relative;
      display:flex;
      flex-direction:column;
      width:60%;
      padding:24px;
      background:white;
      color:rgb(14,30,37);
      border-radius:8px;
      box-shadow:0 2px 4px 0 rgba(14,30,37,.16);
    }

    .progress-wrap { padding: 15px 50px 25px 15px; margin-bottom: 1rem; flex-direction: row; align-items: center; }
    .progress-wrap .progress-info { display: flex; flex-direction: column; flex: 1; }
    .progress-wrap .progress-info span { margin-top: -4px; padding-bottom: 10px; }
    .progress-wrap .progress-info .progress { height: 7px; background-color: #ffffff; }
    .progress-wrap .progress-info .progress .progress-bar{ background-color: #00afe4 !important; }

    .sk-fading-circle {width: 20px;height: 20px;position: relative;margin-right: 10px;}
    .sk-fading-circle .sk-circle {width: 100%;height: 100%;position: absolute;left: 0;top: 0;}
    .sk-fading-circle .sk-circle:before {content: '';display: block;margin: 0 auto;width: 22%;height: 22%;background-color: #748082;border-radius: 100%;-webkit-animation: sk-circleFadeDelay 1.2s infinite ease-in-out both;animation: sk-circleFadeDelay 1.2s infinite ease-in-out both;}
    .sk-fading-circle .sk-circle2 {-webkit-transform: rotate(30deg);-ms-transform: rotate(30deg);transform: rotate(30deg);}
    .sk-fading-circle .sk-circle3 {-webkit-transform: rotate(60deg);-ms-transform: rotate(60deg);transform: rotate(60deg);}
    .sk-fading-circle .sk-circle4 {-webkit-transform: rotate(90deg);-ms-transform: rotate(90deg);transform: rotate(90deg);}
    .sk-fading-circle .sk-circle5 {-webkit-transform: rotate(120deg);-ms-transform: rotate(120deg);transform: rotate(120deg);}
    .sk-fading-circle .sk-circle6 {-webkit-transform: rotate(150deg);-ms-transform: rotate(150deg);transform: rotate(150deg);}
    .sk-fading-circle .sk-circle7 {-webkit-transform: rotate(180deg);-ms-transform: rotate(180deg);transform: rotate(180deg);}
    .sk-fading-circle .sk-circle8 {-webkit-transform: rotate(210deg);-ms-transform: rotate(210deg);transform: rotate(210deg);}
    .sk-fading-circle .sk-circle9 {-webkit-transform: rotate(240deg);-ms-transform: rotate(240deg);transform: rotate(240deg);}
    .sk-fading-circle .sk-circle10 {-webkit-transform: rotate(270deg);-ms-transform: rotate(270deg);transform: rotate(270deg);}
    .sk-fading-circle .sk-circle11 {-webkit-transform: rotate(300deg);-ms-transform: rotate(300deg);transform: rotate(300deg);}
    .sk-fading-circle .sk-circle12 {-webkit-transform: rotate(330deg);-ms-transform: rotate(330deg);transform: rotate(330deg);}
    .sk-fading-circle .sk-circle2:before {-webkit-animation-delay: -1.1s;animation-delay: -1.1s;}
    .sk-fading-circle .sk-circle3:before {-webkit-animation-delay: -1s;animation-delay: -1s;}
    .sk-fading-circle .sk-circle4:before {-webkit-animation-delay: -0.9s;animation-delay: -0.9s;}
    .sk-fading-circle .sk-circle5:before {-webkit-animation-delay: -0.8s;animation-delay: -0.8s;}
    .sk-fading-circle .sk-circle6:before {-webkit-animation-delay: -0.7s;animation-delay: -0.7s;}
    .sk-fading-circle .sk-circle7:before {-webkit-animation-delay: -0.6s;animation-delay: -0.6s;}
    .sk-fading-circle .sk-circle8:before {-webkit-animation-delay: -0.5s;animation-delay: -0.5s;}
    .sk-fading-circle .sk-circle9:before {-webkit-animation-delay: -0.4s;animation-delay: -0.4s;}
    .sk-fading-circle .sk-circle10:before {-webkit-animation-delay: -0.3s;animation-delay: -0.3s;}
    .sk-fading-circle .sk-circle11:before {-webkit-animation-delay: -0.2s;animation-delay: -0.2s;}
    .sk-fading-circle .sk-circle12:before {-webkit-animation-delay: -0.1s;animation-delay: -0.1s;}

    @-webkit-keyframes sk-circleFadeDelay {
      0%, 39%, 100% { opacity: 0; }
      40% { opacity: 1; }
    }

    @keyframes sk-circleFadeDelay {
      0%, 39%, 100% { opacity: 0; }
      40% { opacity: 1; }
    }
  </style>
  <script>
    function handleResponse(res) {
      if (res.ok) {
        return res.json()
      } else {
        try {
          let error = res.statusText || 'error'
          error['response'] = res
          return { error, statusCode: res.status }
        } catch (err) {}
      }
    }

    try {
      let eleProgress
      let eleStatus
      let retries = 0

      const retryInterval = 2000
      const maxWait = 70000
      const maxRetries = Math.ceil(maxWait / retryInterval)

      const interval = setInterval(() => {
        fetch('${progressUrl}/${id}')
          .then(handleResponse)
          .then(res => {
            if (res && res.error) {
              clearInterval(interval)
              console.error(res.statusCode, res.error)
              window.location.replace(window.location.origin + window.location.pathname + '?error=' + res.error)
            } else if (res && res.progress) {
              const { progress, status, ok } = res

              eleProgress = eleProgress || document.getElementById('progress_bar')
              eleProgress.style.width = progress + '%'

              let statusMsg = status.split(' ')[0]
              switch (statusMsg) {
                case 'functions': statusMsg = 'Compute engine'; break
                case 'key-value': statusMsg = 'Integrated key-value store'; break
                case 'storage': statusMsg = 'Object store and CDN'; break
                default: statusMsg = ''
              }

              if (statusMsg && ok) {
                eleStatus = eleStatus || document.getElementById('progress_status')
                eleStatus.textContent = statusMsg + ' ready...'
              }

              if (progress >= 100 || retries++ >= maxRetries) {
                clearInterval(interval)
                window.location.replace('${loginUrl}')
              }
            }
          })
      }, retryInterval)
    } catch (err) {
      console.log(err)
    }
  </script>
</head>
<body>
  <div class="progress-wrap card">
    <div class="sk-fading-circle">
    <div class="sk-circle1 sk-circle"></div>
    <div class="sk-circle2 sk-circle"></div>
    <div class="sk-circle3 sk-circle"></div>
    <div class="sk-circle4 sk-circle"></div>
    <div class="sk-circle5 sk-circle"></div>
    <div class="sk-circle6 sk-circle"></div>
    <div class="sk-circle7 sk-circle"></div>
    <div class="sk-circle8 sk-circle"></div>
    <div class="sk-circle9 sk-circle"></div>
    <div class="sk-circle10 sk-circle"></div>
    <div class="sk-circle11 sk-circle"></div>
    <div class="sk-circle12 sk-circle"></div>
  </div>
  <div class="progress-info">
    <h3>Configuring your Cloud.</h3>This should complete in approximately 60 seconds.
    <p style="margin-top: 5px;">
      <span id="progress_status"></span>
    </p>
    <div class="progress">
      <div class="progress-bar" id="progress_bar" style="background-color: #4197a7" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
    </div>
  </div>
</body></html>`
}

// Contains support for the oauth flows underlying interactive login and `nim auth github`.  Also support for
// the tokenizer used to pass credentials between workbenches and CLI.

// The response can be either
export type OAuthResponse = FullCredentials | IdProvider | true

// Differentiate responses
export function isFullCredentials(toTest: OAuthResponse): toTest is FullCredentials {
  return toTest !== true && 'status' in toTest && toTest.status === 'success'
}

export function isGithubProvider(toTest: OAuthResponse): toTest is IdProvider {
  return toTest != true && 'provider' in toTest && toTest.provider.toLowerCase() === 'github'
}

function providerFromResponse(response: OAuthResponse): string {
  if (response === true) {
    return ''
  } else if (isFullCredentials(response)) {
    return response.externalId ? response.externalId.provider : ''
  } else {
    return response['provider']
  }
}

// Compute the API url for a given namespace on a given host.   To this result, one typically appends
// /pkg/action in order to invoke a (web) action.  The form of URL used here goes through the bucket ingress,
// not directly to the api ingress
function getAPIUrl(namespace: string, apihost: string): string {
  const hostURL = new URL(apihost)
  return `https://${namespace}-${hostURL.hostname}/api`
}

// Calculate the reentry point for redirects from the Auth0 flows back to the workbench
function wbReentry(): string {
  const { host, protocol, pathname } = window.location
  return `${protocol}//${host}${pathname}`
}

// Do an interactive token flow, either to establish an Nimbella account or to add a github account.
// The behavior in the browser is quite different from the CLI.  In a CLI, this function returns a
// Promise, which, when resolved, provides the information needed to store the credentials.
// In a browser, it just returns a Promise<true> which can be discarded; the return flow with the
// real information happens by a redirect in the browser causing the workbench to be invoked again.
export async function doOAuthFlow(logger: NimLogger, githubOnly: boolean, apihost: string): Promise<OAuthResponse> {
  // Common setup
  let deferredResolve: (response: OAuthResponse) => void
  let deferredReject

  const deferredPromise = new Promise<OAuthResponse>(function(resolve, reject) {
    deferredResolve = resolve
    deferredReject = reject
  })

  const query = {
    provider: githubOnly ? 'github' : undefined,
    redirect: inBrowser ? wbReentry() : true
  }

  let loginUrl // needs to be computed differently when not in browser
  const progressUrl = getAPIUrl(NAMESPACE, apihost || DEFAULT_APIHOST) + PROGRESS

  // Non-browser setup
  if (!inBrowser) {
    const createServer = require('http').createServer
    const getPort = require('get-port')
    const port = await getPort({ port: 3000 })
    query['port'] = port

    const server = createServer(function(req, res) {
      const parameters = querystring.parse(req.url.slice(req.url.indexOf('?') + 1))
      if (parameters.token) {
        let response: OAuthResponse
        try {
          const buffer = Buffer.from(parameters.token as string, 'base64')
          response = JSON.parse(buffer.toString('ascii'))
          res.end(loginHtml(providerFromResponse(response)))
          deferredResolve(response)
        } catch (e) {
          res.end('Bad request.')
          deferredReject(e)
        }
      } else if (parameters.id) {
        // need the login url at this point to redirect again once the account is created
        loginUrl = getAPIUrl(NAMESPACE, apihost || DEFAULT_APIHOST) + LOGIN + '?' + querystring.stringify(query)
        res.end(provisioningHtml(loginUrl, progressUrl, parameters.id))
      } else if (parameters.error) {
        res.end('Bad request.')
        deferredReject(new Error('Authentication service error. Got invalid parameters for CLI login.'))
      } else {
        // Only expecting ?id, ?token and ?error requests on localhost so
        // reject any other requests but do not resolve the promise
        // with a failure since these requests could come from the browser
        // fetching favicon for example (or the user doing something
        // non-standard in the browser). The server does eventually time out.
        res.end('Bad request.')
      }
    })

    const loginServerTimeout = setTimeout(() => {
      deferredResolve(true)
    }, 75000)

    deferredPromise.then(() => {
      if (server) {
        server.close()
        clearTimeout(loginServerTimeout)
      }
    }).catch(() => {
      if (server) {
        server.close()
        clearTimeout(loginServerTimeout)
      }
    })

    await new Promise(function(resolve, reject) {
      server.on('error', reject)
      server.listen(port, resolve)
    })
  } else {
    // for browser, we will just return Promise<true> because the real callback will be in a separate flow altogether
    deferredResolve(true)
    query['tokenize'] = !githubOnly
  }

  // Common code
  loginUrl = loginUrl || getAPIUrl(NAMESPACE, apihost || DEFAULT_APIHOST) + LOGIN + '?' + querystring.stringify(query)
  debug("computed url: %s", loginUrl)

  try {
    if (inBrowser) {
      window.location.href = loginUrl
    } else {
      logger.log('Opening browser to authenticate...')
      await open(loginUrl)
    }
  } catch (err) {
    logger.handleError('Nimbella CLI could not open the browser for you.' +
      ' Please visit this URL in a browser on this device: ' + loginUrl,
      err)
  }

  return await deferredPromise
}

// Invoke the tokenizer given low level OW credentials (auth and apihost), getting back a bearer token to full credentials
export async function getCredentialsToken(ow: OWOptions, logger: NimLogger, nonExpiring: boolean = false): Promise<string> {
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
