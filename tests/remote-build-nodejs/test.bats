load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build-nodejs"
}

@test "deploy nodejs projects with remote build" {
  run $NIM project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line -p "Submitted action 'default' for remote building and deployment in runtime nodejs:default"
}

@test "invoke remotely built nodejs lang actions" {
	test_binary_action test-remote-build-nodejs/default "Nine Thousand Nine Hundred Ninety Nine"
}
