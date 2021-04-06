load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build-swift"
}

@test "deploy swift projects with remote build" {
  run $NIM project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line "Submitted action 'default' for remote building and deployment in runtime swift:default"
	assert_line "Submitted action 'multi' for remote building and deployment in runtime swift:default"
}

@test "invoke remotely built swift lang actions" {
	test_binary_action test-remote-build-swift/default "To be implemented"
	test_binary_action test-remote-build-swift/multi "Hello stranger!"
}
