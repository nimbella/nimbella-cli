load ../test_setup.bash

teardown_file() {
	delete_package "test-remote-build-java"
}

@test "deploy java projects with remote build" {
  run $NIM project deploy $BATS_TEST_DIRNAME --remote-build
	assert_success
	assert_line -p "Submitted action 'default' for remote building and deployment in runtime java:default"
	assert_line -p "Submitted action 'mvn' for remote building and deployment in runtime java:default"
	assert_line -p "Submitted action 'gradle' for remote building and deployment in runtime java:default"
}

@test "invoke remotely built java lang actions" {
	test_binary_action test-remote-build-java/default "Hello stranger!"
	test_binary_action test-remote-build-java/mvn "data:image/png;base64,iVBORw"
	test_binary_action test-remote-build-java/gradle "data:image/png;base64,iVBORw"
}
