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
import { NimBaseCommand, NimLogger, authPersister, getCredentials } from '@nimbella/nimbella-deployer'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
export default class ProjectServeWeb extends NimBaseCommand {
  static description = 'Serves content from the local Web folder, proxying API requests to given/current namespace'

  static flags = {
    namespace: flags.string({ description: 'The namespace to proxy (current namespace if omitted)' }),
    apihost: flags.string({ description: 'API host of the namespace' }),
    port: flags.integer({ description: 'The port of the web server' }),
    ...NimBaseCommand.flags
  }

  static args = [
    { name: 'location', description: 'The location of web content', required: true, default: './web' }
  ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    const webLocation = args.location
    if (!existsSync(webLocation)) { logger.log(`${webLocation} not found`); return }

    const cred = await getCredentials(authPersister)
    const url = new URL(cred.ow.apihost)
    const proxy = `https://${flags.namespace || cred.namespace}-${flags.apihost || url.hostname}`
    const port = flags.port || 8080

    logger.log(`Proxying API call to ${proxy}`)

    const packLocation = join(webLocation, 'package.json')
    if (existsSync(packLocation)) {
      const content = require(packLocation)
      content.proxy = proxy
      writeFileSync(packLocation, JSON.stringify(content, null, 2))
      const npmRunner = spawn('npm start', {
        stdio: 'inherit',
        shell: true,
        cwd: webLocation,
        detached: false
      })
      npmRunner.on('exit', (code, signal) => {
        this.wrap(content, packLocation, logger, code, signal)
      })
      npmRunner.on('close', (code, signal) => {
        this.wrap(content, packLocation, logger, code, signal)
      })
    } else {
      const httpServer = spawn(`npx http-server -c-1 -p ${port} --proxy ${proxy}`, {
        stdio: 'inherit',
        shell: true,
        cwd: webLocation
      })
      httpServer.on('close', (code, signal) => {
        logger.log(`Runner exited with code ${code} ${signal ? `and signal ${signal}` : ''}`)
      })
    }
  }

  private wrap(content: any, location: string, logger: NimLogger, code: number, signal: string) {
    delete content.proxy
    writeFileSync(location, JSON.stringify(content, null, 2))
    logger.log(`Runner exited with code ${code} ${signal ? `and signal ${signal}` : ''}`)
  }
}
