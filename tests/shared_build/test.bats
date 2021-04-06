load ../test_setup.bash

teardown_file() {
	delete_package "test-shared-build"
}

@test "deploy projects with shared build" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_success
	assert_output --partial 'Running shared build'
	assert_output --partial 'Skipping shared build'
}

@test "actions in projects with shared build work" {
	run $NIM action invoke test-shared-build/first-test
	assert_success
	assert_output --partial '"msg": "guvf vf gur svefg zrffntr"'
	run $NIM action invoke test-shared-build/second-test
	assert_success
	assert_output --partial '"msg": "guvf vf gur frpbaq zrffntr"'
}
