load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test-unweb"
}

@test "deploy project with default web values" {
	run $NIM action get test-unweb/notify
	assert_success
	assert_output --partial '{
      "key": "web-export",
      "value": true
    },'
	assert_output --partial '{
      "key": "require-whisk-auth",
      "value": false
    },'
	$NIM project deploy $BATS_TEST_DIRNAME/unweb-with-config
  run $NIM action get test-unweb/notify
	assert_success
	assert_output --partial '{
      "key": "web-export",
      "value": false
    },'
	assert_output --partial '{
      "key": "require-whisk-auth",
      "value": true
    },'
}
