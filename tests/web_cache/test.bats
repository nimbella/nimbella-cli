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
	APIHOST=$($NIM auth current --apihost)
	run curl -I $($NIM web get test-web-cache.html --url)
	assert_success
	if [[ "$APIHOST" == *"eks"* ]]; then
	  [[ "$output" != *"cache-control"* ]]
	else 
	  assert_output --regexp "^.*cache-control: *public, *max-age=3600.*$"
	fi
}

@test "deploy project web resources with caching off" {
	run curl -I $($NIM web get test-web-cache-off.html --url)
	assert_success
	assert_output --regexp "^.*cache-control: *no-cache.*$"
}
