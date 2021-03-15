load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME/existing-project
}

teardown_file() {
	$NIM action delete test-errors
}

@test "deploying project using clashing resource identifiers" {
	run $NIM project deploy $BATS_TEST_DIRNAME/resource-clash-error
	assert_failure
	assert_output --partial "Error: While deploying action 'test-errors/verifier'"
	assert_output --partial "Error: While deploying package 'test-errors'"
}

@test "deploying project using misspelled actions" {
	run $NIM project deploy $BATS_TEST_DIRNAME/misspelled-config
	assert_failure
	assert_output --partial "Error: While deploying action 'emayl/verifier'"
	assert_output --partial "does not exist in the project"
}
