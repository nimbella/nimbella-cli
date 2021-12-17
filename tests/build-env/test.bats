load ../test_setup.bash

teardown_file() {
  delete_package "test-build-env"
}

@test "deploy projects with build environment (local build)" {
  run $NIM project deploy $BATS_TEST_DIRNAME --build-env $BATS_TEST_DIRNAME/build.env 
  assert_success
  assert_output --partial "Deployed actions"
  assert_output --partial "- test-build-env/test"
}

@test "invoke function built with build environment (local build)" {
  run $NIM action invoke -r test-build-env/test
  assert_output --partial "Hello sammy!"
}

@test "deploy projects with build environment (remote build)" {
  run rm $BATS_TEST_DIRNAME/packages/test-build-env/test/__deployer__.zip
  run rm $BATS_TEST_DIRNAME/packages/test-build-env/test/config.json
  delete_package "test-build-env"
  run $NIM project deploy $BATS_TEST_DIRNAME --build-env $BATS_TEST_DIRNAME/build.env --remote-build 
  assert_success
  assert_output --partial "Deployed actions"
  assert_output --partial "- test-build-env/test"
}

@test "invoke function built with build environment (remote build)" {
  run $NIM action invoke -r test-build-env/test
  assert_output --partial "Hello sammy!"
}

