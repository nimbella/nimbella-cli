#!/usr/bin/env node

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

import { initializeAPI } from 'nimbella-deployer'
import { CLIError } from '@oclif/errors'

// A screening function called at top level (before the real oclif dispatching begins).  Does various fixups.
export async function run() {
  // Get topics info from package.json
  const pj = require('../package.json')
  const topics = pj.oclif.topics
  const topicNames = Object.keys(topics)
  // Compute user agent
  const userAgent = 'nimbella-cli/' + pj.version
  // Initialize the API environment
  initializeAPI(userAgent)
  // Split an initial colon-separated topic:command token if found.  As the topic portion could be an alias, we look for that case also
  decolonize(topics)
  // Apply topic aliases (should come before colonize because colonize will only glue topics, not aliases)
  applyTopicAliases(topics)
  // Insert a colon between the first two tokens if the first token matches a topic
  colonize(topicNames)
  // Run the command while cleaning up errors that have leaked from the oclif mechanism
  try {
    await require('@oclif/command').run(undefined, __dirname)
  } catch (err) {
    if (err.message && !err.oclif) {
      err = new CLIError(err.message, { exit: 1 })
    }
    throw err
  }
}

// Apply topic aliases.  The semantics are consistent with (open issue) https://github.com/oclif/oclif/issues/237 but we
// process the information here instead of inside oclif/config.   The argument is the entry array of the topics
// member of package.json.
function applyTopicAliases(topics: any) {
  const possibleAlias = process.argv[2]
  for (const topic in topics) {
    const def = topics[topic]
    if (def.aliases && def.aliases.includes(possibleAlias)) {
      process.argv[2] = topic
      return
    }
  }
}

// Split the first non-flag token on a colon if present and if the leading part is a topic or alias
function decolonize(topics: any) {
  const argvbase = process.argv.slice(0, 2)
  const oldargv = process.argv.slice(2)
  const cmdTokens: string[] = []
  for (const arg of oldargv) {
    if (cmdTokens.length < 2 && !isFlag(arg)) {
      const parts = arg.split(':')
      if (isTopicOrAlias(parts[0], topics)) {
        cmdTokens.push(...parts)
      } else {
        cmdTokens.push(arg)
      }
    } else {
      cmdTokens.push(arg)
    }
  }
  process.argv = argvbase.concat(cmdTokens)
}

// Check whether a token matches a topic or alias
function isTopicOrAlias(token: string, topics: any): boolean {
  for (const topic in topics) {
    if (token == topic) {
      return true
    }
    const def = topics[topic]
    if (def.aliases && def.aliases.includes(token)) {
      return true
    }
  }
  return false
}

// Check whether a token is a flag
function isFlag(token: string): boolean {
  return token.startsWith('-')
}

// Heuristically combine the first two consecutive non-flag non-help arguments in process.argv using a colon separator,
// starting at index position 2, iff the first such argument is a known topic.  This will be useful to the extent
// that the topic space has a limited depth (there are no commands requiring more than one colon separator).
// This is true at present and can be easily adjusted in the future).
function colonize(topics: string[]) {
  const args = process.argv
  let index = 2
  while (index < args.length && (isFlag(args[index]) || args[index] === 'help')) {
    index++
  }
  if (index > args.length - 2 || isFlag(args[index + 1]) || args[index] === 'help') {
    return
  }
  if (!topics.includes(args[index])) {
    return
  }
  const combined = args[index] + ':' + args[index + 1]
  const prefix = args.slice(0, index)
  const suffix = args.slice(index + 2)
  process.argv = prefix.concat([combined]).concat(suffix)
}
