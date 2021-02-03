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

import { NimLogger } from 'nimbella-deployer'
import { open } from './ui'
const workbenchURL = 'https://apigcp.nimbella.io/wb'
const previewURL = 'https://preview-apigcp.nimbella.io/workbench'

// Utility to open the workbench with or without an initial command.
// Used by both "workbench:run" and "workbench:login".
// Not expected to be used in the browser.

export function openWorkbench(command: string, preview: boolean, logger: NimLogger) {
  let query = ''
  if (command) {
    query = '?command=' + encodeURIComponent(command)
  }
  const url = (preview ? previewURL : workbenchURL) + query
  open(url)
}
