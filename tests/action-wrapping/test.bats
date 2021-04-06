load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test-action-wrapping"
}

@test "can retrieve web actions using action wrapping" {
	run $NIM action list
	assert_success
	assert_output --partial 'test-action-wrapping/index'
	assert_output --partial 'test-action-wrapping/logo.png'
	INDEX_URL=$($NIM action get test-action-wrapping/index --url)
	LOGO_URL=$($NIM action get test-action-wrapping/logo.png --url)
	run diff <(curl -s $INDEX_URL) <(cat $BATS_TEST_DIRNAME/web/index.html)
	assert_success
	run diff <(curl -s $LOGO_URL) <(cat $BATS_TEST_DIRNAME/web/logo.png)
	assert_success
}
