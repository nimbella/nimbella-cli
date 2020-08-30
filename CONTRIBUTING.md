## Contributing to the Nimbella CLI

This document outlines the process for contributing to `nim`. It also provides some specific guidance for code contributions.

- We have a [Code of Conduct](CODE_OF_CONDUCT.md), please review it so you are familiar with the project values.

---

### Issues

The easiest way to contribute is to open an issue with a bug report or a suggestion for improvement.   We do not have a prescriptive issue template.  We merely request that you take the time to communicate clearly so that we can understand what is being requested and respond appropriately.

- For bug reports, give as much detail as you can about exactly what you were doing when the problem occurred and use transcripts or screen shots to show the problematic behavior.
- For enhancement requests, give the context.  Ideally, explain why the Nimbella community would be interested in the improvement.  Then, be as explicit as you can about how you see the change working, down to a proposed syntax.
- Check other open issues and add comments to existing issues rather than creating duplicates.

---

### Contributions of source code

All such contributions should be in the form of pull requests.  The exact format of the pull request description is not important but it should include

- _motivation_: what problem the contribution is trying to solve and why it should be regarded as helpful
- _externals_: what visible changes to the behavior of `nim` will occur if the pull request is merged
- _internals_: (if a reading of the code is likely to raise questions) anything that will help orient a reviewer to reading the code.

By opening a pull request

- You agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
- When you open a pull request with your contributions, **you are certifying that you wrote the code** in the corresponding patch pursuant to the [Developer Certificate of Origin](#developer-certificate-of-origin) included below for your reference.
- You must conform to our style guidelines.  Issue `npm run lint` and fix any errors or warnings before submitting.
- If you're contributing a new `nim` subcommand, you must follow the [guide below](#creating-a-new-subcommand).

---

### Contact us.

We're always happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com/) to engage with us for a more rapid response.

---

### Creating a new `nim` subcommand

The Nimbella CLI is built on the [oclif framework](https://oclif.io/docs/commands).  But, `nim` adds a layer to `oclif` to facilitate embedding `nim` subcommands in browser-based environments such as our workbench.  Having familiarized yourself with writing `oclif` commands, consider the following additional rules.

1.  By convention, the "topic" tree in `nim` has limited depth.  You can have a command called `nim shop meat` but not `nim shop groceries meat`.
2. Every topic (like `shop` in the above example) _must_ be listed in `oclif.topics` in `package.json`.  This is optional for `oclif` but required for `nim`.
3. All `nim` commands must inherit from 

---

### Developer Certificate of Origin

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
1 Letterman Drive
Suite D4700
San Francisco, CA, 94129

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```
