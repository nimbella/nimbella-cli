load ../test_setup.bash

@test "deploy project with invalid runtime" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_failure
	assert_output --partial "Error: 'xyz' is not a valid runtime value"
}
