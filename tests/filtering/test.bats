load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test-filtering"
}

@test "should not deploy filtered web resources" {
	run $NIM web list
	assert_success
	refute_output --partial "foo.html~"
}

@test "should not deploy filtered package resources" {
	ZIPFILE=packages/test-filtering/test/__deployer__.zip
	assert_file_not_exist $ZIPFILE
}
