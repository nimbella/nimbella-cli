load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME/use-cache-false
	$NIM project deploy $BATS_TEST_DIRNAME/use-cache-true
}

teardown_file() {
	$NIM web:delete test-web-cache.html
	$NIM web:delete test-web-cache-off.html
}

@test "deploy project web resources with caching on" {
	run curl -I $($NIM web get test-web-cache.html --url)
	assert_success
	assert_output --partial "cache-control: public, max-age=3600"
}

@test "deploy project web resources with caching off" {
	run curl -I $($NIM web get test-web-cache-off.html --url)
	assert_success
	assert_output --partial "cache-control: no-cache"
}
