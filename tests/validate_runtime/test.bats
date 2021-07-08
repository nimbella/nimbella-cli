load ../test_setup.bash

@test "deploy project with invalid runtime" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_failure
	assert_output --partial "Error: Invalid project configuration file (project.yml): 'xyz' is not a"
	assert_output --partial "valid runtime value"
}
