load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build-python"
}

@test "deploy python projects with remote build" {
  run $NIM project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line "Submitted action 'default' for remote building and deployment in runtime python:default"
}

@test "invoke remotely built python lang actions" {
	test_binary_action test-remote-build-python/default "When Chuck Norris throws exceptions, it's across the room."
}
