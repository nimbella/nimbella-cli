load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	$NIM web:delete lib/test-web-include.html
}

@test "deploy project with web content included" {
	run $NIM web:list
	assert_success
	assert_line 'lib/test-web-include.html'
}
