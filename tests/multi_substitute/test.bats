load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test_multi_substitute"
}

@test "deploy project with multi-level parameter substitution" {
	run nim action get test_multi_substitute/hello
	assert_success
	assert_output --partial '"parameters": [
    {
      "key": "A",
      "value": "this is A"
    },
    {
      "key": "B",
      "value": "this is B"
    },
    {
      "init": true,
      "key": "C",
      "value": "this is C"
    }
  ],'
}
