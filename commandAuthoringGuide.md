### Creating a new `nim` subcommand

The Nimbella CLI is built on the [oclif framework](https://oclif.io).  Familiarity with that framework is helpful in understanding the following but is not a substitute for the following.

The Nimbella CLI includes the [plugins plugin](https://oclif.io/doc/plugins).  Before adding a command to `nim`, consider whether the constituency for the command is narrow enough that it might better be provided in the form of a plugin.  By publishing the plugin to an `npm` repository, `nim` users will be able to install it with

```
nim plugin install <your-plugin>
```

If you do submit a PR to add a command directly to `nim`, the following guidelines must be followed.   Look at the source of an existing command for examples of correct usage.  

**(1)** We support subcommands at top level and commands under one level of topic.  We do not support more deeply nested topics.  You can have a command called 

```
nim buy
```

or

```
nim shopping buy
```

but not 

```
nim shopping groceries buy
```

**(2)** Every topic (like `shopping` in the above example) _must_ be listed in `oclif.topics` in `package.json`.

**(3)** All `nim` subcommands must inherit from `NimBaseCommand`.

**(4)** `NimBaseCommand` contains a standard implementation of the usual oclif `run` function.  Do not override that function.  Instead, implement `runCommand`.  A description of the arguments passed to that function can be found in `NimBaseCommand.ts`.

**(5)** Do not call methods of `oclif`'s `Command` class via `this` if they write to the console or may terminate execution.  Instead, use the `logger` argument that is passed to `runCommand`.   It conforms to the type `NimLogger` and has the methods

```
log
exit
handleError
displayError
```

(see `NimBaseCommand.ts`).   The first two of these duplicate methods provided by `oclif`'s `Command` and should always be preferred.

**(6)** As much as possible, handle errors using `logger.handleError`.  This method was adopted from Adobe's `aio` and provides greater uniformity in error handling than can be achieved using `oclif` alone.

**(7)** Don't use `console.log` at all and avoid introducing new dependencies for CLI-based interaction.  Rather

- for normal execution output use `logger.log`
- for debugging use `debug`
- if you need CLI "art" you can use `chalk` but sparingly.  Do not directly use `cli-ux`.  The source `ui.ts` provides some utilities for safely interacting with the user (e.g. prompting)


