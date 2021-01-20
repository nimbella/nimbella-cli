## About Nimbella.

We're building a beautiful cloud so your experience is delightful, one
that allows you to focus on what you do best: explore idea, create
value, and deliver applications that you are proud of. We are excited
to see what you will build today, and we want to hear from you: what
worked, what didn't, what we can do better — after all, we are not
done and there is more to come. Reach us on
[Slack](https://nimbella-community.slack.com/) or on
[GitHub](https://github.com/nimbella/nimbella-cli/issues). Your
Nimbella cloud account gives you all of the following features and
benefits:

- A dedicated and secure domain name for your cloud applications. If
  you need more, let us know.
- Static front-end assets are automatically deployed to and served
  from a global CDN.
- Back-ends are run on demand, near-instantly. No servers for you to
  be bothered with, ever.
- Upload files to a secured data bucket, grant limited access as
  needed.
- Record application state in a key-value store, with data accessible
  to all your back-end logic at extremely low latency.
- Build workflows and orchestrate long running tasks.

This repository contains the source to our `nim` command line tool.
It is possible to contribute. See [our contribution guide](CONTRIBUTING.md).

## Development 

### Building the project code

To build the code, run the following commands from the project directory.

```
cd deployer
npm install
npm pack
cd ..
npm install
npm pack
```

### Testing in development

If you need to run commands using the local version of the project during development - once you have built the project source code - run the following command:

```
./bin/run <nim commands>
```

Remember to re-build the project (`tsc -b`) after making changes before testing.

### Distribution of the package

The build process above gives you a tarball that can be installed globally or used as a dependency _on the machine on which it was built._ It is not suitable for publication. To obtain a tarball that can be used more widely:

1. After building in `deployer` publish the result somewhere (publish to `npm`, place in a web bucket, make it available as static content to a web server, etc.)
2. Change the dependency on `nimbella-deployer` in `package.json` to reference the published version.
3. Complete the build.

The current build will create a version of `nim` suitable for use with services on `nimbella.io`. It presumes the runtime repertoire that is present there, and uses the "error page" (404.html) that is used on `nimbella.io`. You can change these things by placing your own files `runtimes.json` or `404.html` in the `deployer` directory.
