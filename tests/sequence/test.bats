load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test-sequence"
}

@test "invoking sequence runs individual actions" {
	run $NIM action invoke test-sequence/mySequence --param payload '"Over-ripe sushi,\nThe Master\nIs full of regret."'
	assert_success
	assert_output '{
  "length": 3,
  "lines": [
    "Is full of regret.",
    "Over-ripe sushi,",
    "The Master"
  ]
}'
}
