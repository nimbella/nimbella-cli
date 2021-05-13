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

// Utilities for UI, versioned for CLI and workbench.   Interaction with the user has to be done differently
// (in general) in the two cases.

import { inBrowser } from '@nimbella/nimbella-deployer'

let kuiPrompt: (msg: string) => Promise<string>
let kuiOpen: (url: string) => Promise<any>
let cli

// Allow the cloud-workbench to install a kui-friendly 'open' (uses the sidecar)
export function setKuiOpen(opener: (url: string) => Promise<any>): void {
  kuiOpen = opener
}

// Open a URL in 'the' browser or the system default browser
// Note: this is reliable for http[s] absolute URLs.  It won't work on file URLs in the browser.
// Whether or not it works on relative URLs in the browser depends on how the files are packaged by webpack.
// If the files are buried in webpack bundles this function will not work for them.
export function open(url: string, sidecar = false): any {
  if (inBrowser) {
    if (sidecar && kuiOpen) {
      return kuiOpen(url)
    } else {
      return window.open(url)
    }
  } else {
    return require('open')(url)
  }
}

// Allow the cloud-workbench to install a kui-friendly prompter
export function setKuiPrompter(prompter: (msg: string) => Promise<string>): void {
  kuiPrompt = prompter
}

// Prompt the user
export async function prompt(msg: string): Promise<string> {
  if (inBrowser) {
    if (!kuiPrompt) {
      throw new Error('Running in browser and there is no prompt support installed, cannot proceed')
    }
    return await kuiPrompt(msg)
  } else {
    if (!cli) { cli = require('cli-ux').cli }
    return await cli.prompt(msg)
  }
}

// Specialized prompt for selecting from a list of strings
export async function choicePrompter(choices: string[]): Promise<string> {
  const promptLines: string[] = []
  for (let i = 0; i < choices.length; i++) {
    promptLines.push(`${i}: ${choices[i]}`)
  }
  promptLines.push('Choose by number')
  let promptText = promptLines.join('\n')
  let choice: string
  while (!choice) {
    const response = await prompt(promptText)
    promptText = 'Choose by number'
    const index = +response
    if (!isNaN(index) && index >= 0 && index < choices.length) {
      choice = choices[index]
      break
    }
  }
  return choice
}

export async function spinner(): Promise<any> {
  if (inBrowser) {
    return Promise.resolve({
      start: _ => { /* no-op */ },
      stop: _ => { /* no-op */ }
    })
  } else {
    if (!cli) { cli = require('cli-ux').cli }
    return await cli.action
  }
}
