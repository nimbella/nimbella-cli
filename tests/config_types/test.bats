load ../test_setup.bash

@test "cannot deploy project with invalid annotations" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-annotations
	assert_failure
	assert_output --partial "Error: Invalid project configuration file (project.yml): annotations must"
	assert_output --partial "be a dictionary"
}

@test "cannot deploy project with invalid env" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-env
	assert_failure
	assert_output --partial "Error: Invalid project configuration file (project.yml): the environment"
	assert_output --partial "clause must be a dictionary"
}

@test "cannot deploy project with invalid parameters" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-parameters
	assert_failure
	assert_output --partial "Error: Invalid project configuration file (project.yml): parameters must"
	assert_output --partial "be a dictionary"
}

@test "cannot deploy project with invalid top-level parameter " {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-parameters-toplevel
	assert_failure
	assert_output --partial "Error: Invalid project configuration file (project.yml): parameters member"
	assert_output --partial "must be a dictionary"
}
