## Functional Tests for Nimbella CLI 

This directory contains the CLI test suite for verify the external CLI commands work as expected. It uses the [bats](https://github.com/bats-core/bats-core) shell script testing tool to run sample commands against pre-configured namespaces and checks the results.

### Running the tests

- Install the `bats` tool.

```
npm install -g bats
```

- Install the `bats` plugin (managed as npm dev deps).

```
npm install
```

- Run the following command.

```
npm test
```

Output like this should be shown if all the tests pass:

```
$ npm test
 ✓ cannot deploy project with invalid annotations
 ✓ cannot deploy project with invalid env
 ✓ cannot deploy project with invalid parameters
 ...
 10 tests, 0 failure
```

### Adding a new test

- Create a new sub-directory under the `tests` parent directory. 
- Create a `test.bats` file in that directory with the following contents:

```
load ../test_setup.bash

@test "test case description" {	
	run $NIM ...
	assert_success
}
```

- Any test case specific resources should be included under this directory.

#### Test case details

See the [bats documentation](https://bats-core.readthedocs.io/en/latest/writing-tests.html) for information on writing tests using the framework. Here are some Nimbella specific test guidelines...

- The `$NIM` automatically environment variable points to `/bin/run` unless set manually. 
- All test case projects must use packages to deploy actions to ensure there are no name clashes. Package names should match the test case folder name with a "test_" prefix, e.g "my_test" => "test_my_test".
- Use the `$BATS_TEST_DIRNAME` to reference local test file - not relative paths.
- Use a @test statement per test-case - don't run multiple tests in the same @test statement.
- Common setup code across all test files is stored in the `test_setup.bash` file which is imported by the `bats` command.
- All test files should remove all deployed packages upon finishing. This can be handled using the `teardown_file() {...}` bats function in the test files.
