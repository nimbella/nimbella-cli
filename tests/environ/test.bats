load ../test_setup.bash

get_action_kind () {
	$NIM action get test_environ/variable | jq -r .exec.kind
}

teardown_file() {
	delete_package "test_environ"
}

@test "deploying project using '.env' default" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_success
	run get_action_kind
	assert_output "cloudjs:10"
}

@test "deploying project using alternative file 'test.env'" {
	run $NIM project deploy $BATS_TEST_DIRNAME --env $BATS_TEST_DIRNAME/test.env
	assert_success
	run get_action_kind
	assert_output "nodejs-lambda:10"
}

@test "deploying project using an environment variable" {
	export RUNTIME='tessjs:10'
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_success
	run get_action_kind
	assert_output "tessjs:10"
}
