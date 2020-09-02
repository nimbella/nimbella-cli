### Creating a new `nim` subcommand

The Nimbella CLI is built on the [oclif framework](https://oclif.io/docs/introduction.html).  Some familiarity with that framework helps in understanding the following.

The Nimbella CLI includes the [plugins plugin](https://github.com/oclif/plugin-plugins).  So, you have a choice.  You can package additional subcommands in a plugin, or you can submit a PR to modify `nim` itself.  The choice should depend on the general applicability of the subcommand.  If the potential usage community for your new command is narrow, consider using a plugin.

Regardless of which you choose, we expect all contributions to conform to our [code of conduct](CODE_OF_CONDUCT.md).

If you do use a plugin,

- you will need to publish it to an `npm` repository or disseminate github coordinates
- you should choose a name for the plugin that starts with `nim-plugin-`
- `nim` users will be able to install it with

```
nim plugin install <your-plugin>
```

- it will be your responsibility to service users of your plugin.  Nimbella will not be able to diagnose problems with it.

If your command is broadly applicable, consider submitting a PR to add the command directly to `nim`.  

- The additional guidelines shown below must be followed.
- Look at the source of an existing subcommand for examples of correct usage.
- If we accept the submission, Nimbella will then take responsibility for servicing users of the command
- If appropriate (no local file system access) we may choose to provide subcommand in the Nimbella workbench

---

Our guidelines for adding subcommands directly to `nim` are _in addition_ to oclif procedures.  Where they appear to conflict, our guidelines take precedence.

**(1)** We support subcommands at top level and under one level of topic.  We do not support more deeply nested topics.  You can have a command called 

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

**(3)** All `nim` subcommands must inherit from [NimBaseCommand](https://github.com/nimbella/nimbella-cli/blob/dd0396b30b47b419717055871f0955c77ad0d833/deployer/src/NimBaseCommand.ts).

**(4)** `NimBaseCommand` contains a standard implementation of the usual oclif `run` function.  Do not override that function.  Instead, implement `runCommand`.  A description of the arguments passed to that function can be found in [NimBaseCommand.ts](https://github.com/nimbella/nimbella-cli/blob/dd0396b30b47b419717055871f0955c77ad0d833/deployer/src/NimBaseCommand.ts#L112).

**(5)** Do not call methods of `oclif`'s `Command` class via `this` if they write to the console or may terminate execution.  Instead, use the `logger` argument that is passed to `runCommand`.   It conforms to the type [NimLogger](https://github.com/nimbella/nimbella-cli/blob/dd0396b30b47b419717055871f0955c77ad0d833/deployer/src/NimBaseCommand.ts#L53) and has the methods

```
log
exit
handleError
displayError
```

The first two of these duplicate methods provided by `oclif`'s `Command` and should always be preferred.

**(6)** As much as possible, handle errors using [logger.handleError](https://github.com/nimbella/nimbella-cli/blob/dd0396b30b47b419717055871f0955c77ad0d833/deployer/src/NimBaseCommand.ts#L241).  This method was adopted from Adobe's `aio` and imposes some uniformity on error handling that users can then rely on.

**(7)** Don't use `console.log` at all.

- for normal execution output use `logger.log`
- for debugging use `debug`

**(8)** Take care with interaction and CLI "art"

- you can use `chalk` sparingly for decoration and contrast
- Do not directly use `cli-ux`: it breaks the Nimbella workbench
- The supplied utilities in [ui.ts](https://github.com/nimbella/nimbella-cli/blob/master/src/ui.ts) abstract some common user interactions such as prompting and spinners.
   - always use these utilities in preference to alternatives when you can
   - if you have a user interaction need that isn't covered by `ui.ts` then add that interaction to `ui.ts` as part of your PR and we will review it accordingly
	- note that `ui.ts` uses `cli-ux` internally but demand-loads it when safe and provide alternatives when running in a web browser.  


