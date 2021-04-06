load ../test_setup.bash

@test "cannot deploy project with invalid annotations" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-annotations
	assert_failure
	assert_output --partial " Error: annotations must be a dictionary"
}

@test "cannot deploy project with invalid env" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-env
	assert_failure
	assert_output --partial " Error: the environment clause must be a dictionary"
}

@test "cannot deploy project with invalid parameters" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-parameters
	assert_failure
	assert_output --partial " Error: parameters must be a dictionary"
}

@test "cannot deploy project with invalid top-level parameter " {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-parameters-toplevel
	assert_failure
	assert_output --partial " Error: parameters member must be a dictionary"
}
