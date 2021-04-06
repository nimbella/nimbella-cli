load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build-php"
}

@test "deploy php projects with remote build" {
  run $NIM project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line "Submitted action 'default' for remote building and deployment in runtime php:default"
}

@test "invoke remotely built php lang actions" {
	test_binary_action test-remote-build-php/default "nine thousand, nine hundred and ninety-nine"
}
