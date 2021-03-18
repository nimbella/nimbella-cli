load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build"
}

test_binary_action() {
	run $NIM action invoke test-remote-build/$1 -f
	assert_success
	assert_output --partial '"status": "success"'
	assert_output --partial $2

	run $NIM action get test-remote-build/$1
	assert_success
	assert_output --partial '"binary": true'
}

@test "deploy projects with remote build" {
  run $NIM project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line "Submitted action 'go-default' for remote building and deployment in runtime go:default"
	assert_line "Submitted action 'go-explicit-version' for remote building and deployment in runtime go:1.12"
	assert_line "Submitted action 'swift-default' for remote building and deployment in runtime swift:default"
	assert_line "Submitted action 'swift-multi' for remote building and deployment in runtime swift:default"
	assert_line "Submitted action 'java-default' for remote building and deployment in runtime java:default"
	assert_line "Submitted action 'java-mvn' for remote building and deployment in runtime java:default"
	assert_line "Submitted action 'java-gradle' for remote building and deployment in runtime java:default"
	assert_line "Submitted action 'python-default' for remote building and deployment in runtime python:default"
	assert_line "Submitted action 'php-default' for remote building and deployment in runtime php:default"
}

@test "invoke remotely built go lang actions" {
	test_binary_action go-default "Hello, stranger!"
	test_binary_action go-explicit-version "Hello, stranger!"
}

@test "invoke remotely built swift lang actions" {
	test_binary_action swift-default "To be implemented"
	test_binary_action swift-multi "Hello stranger!"
}

@test "invoke remotely built java lang actions" {
	test_binary_action java-default "Hello stranger!"
	test_binary_action java-mvn "data:image/png;base64,iVBORw"
	test_binary_action java-gradle "data:image/png;base64,iVBORw"
}

@test "invoke remotely built python lang actions" {
	test_binary_action python-default "When Chuck Norris throws exceptions, it's across the room."
}

@test "invoke remotely built php lang actions" {
	test_binary_action php-default "nine thousand, nine hundred and ninety-nine"
}
