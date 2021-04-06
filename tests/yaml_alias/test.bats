load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test-yaml-alias"
}

@test "deploy project with config containing YAML aliases" {
	run $NIM action get test-yaml-alias/gateway
	assert_success
	assert_output --partial '{
      "key": "require-whisk-auth",
      "value": false
    },'
	run $NIM action get test-yaml-alias/cli-gateway
	assert_success
	assert_output --partial '{
      "key": "require-whisk-auth",
      "value": true
    },'
}
