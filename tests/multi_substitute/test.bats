load ../test_setup.bash

setup_file() {
  export A="this is A"
  export B="this is B"
  export C="this is C"
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test-multi-substitute"
  unset A B C
}

@test "deploy project with multi-level parameter substitution" {
	run $NIM action get test-multi-substitute/hello
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
