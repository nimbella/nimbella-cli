load ../test_setup.bash

@test "deploying project with nothing to deploy" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_success
	assert_output --partial "Nothing deployed"
}
