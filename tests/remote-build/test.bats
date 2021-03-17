load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build"
}

test_binary_action() {
	run nim action invoke test-remote-build/$1 -f
	assert_success
	assert_output --partial '"status": "success"'
	assert_output --partial $2

	run nim action get test-remote-build/$1
	assert_success
	assert_output --partial '"binary": true'
}

@test "deploy projects with remote build" {
  run nim project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line "Submitted action 'go-default' for remote building and deployment in runtime go:default"
	assert_line "Submitted action 'go-explicit-version' for remote building and deployment in runtime go:1.12"
	assert_line "Submitted action 'swift-default' for remote building and deployment in runtime swift:default"
	assert_line "Submitted action 'swift-multi' for remote building and deployment in runtime swift:default"
}

@test "invoke remotely built go lang actions" {
	test_binary_action go-default "Hello, stranger!"
	test_binary_action go-explicit-version "Hello, stranger!"
}

@test "invoke remotely built swift lang actions" {
	test_binary_action swift-default "To be implemented"
	test_binary_action swift-multi "Hello stranger!"
}
