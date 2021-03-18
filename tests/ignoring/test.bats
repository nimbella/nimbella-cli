load ../test_setup.bash

teardown_file() {
	delete_package "test-ignoring"
}

@test "deploy project whilst ignoring local files" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_success
	refute_output --partial '.gitignore'
	refute_output --partial '.DS_Store'
}
