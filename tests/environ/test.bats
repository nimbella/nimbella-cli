#
# Nimbella CONFIDENTIAL
# ---------------------
#
#   2018 - present Nimbella Corp
#   All Rights Reserved.
#
# NOTICE:
#
# All information contained herein is, and remains the property of
# Nimbella Corp and its suppliers, if any.  The intellectual and technical
# concepts contained herein are proprietary to Nimbella Corp and its
# suppliers and may be covered by U.S. and Foreign Patents, patents
# in process, and are protected by trade secret or copyright law.
#
# Dissemination of this information or reproduction of this material
# is strictly forbidden unless prior written permission is obtained
# from Nimbella Corp.
#

# This tests the feature for specifying or defaulting the environment file and
# doing symbol substitution either from the file or from an environment variable


load ../test_setup.bash

get_action_kind () {
	$NIM action get test_environ/variable | jq -r .exec.kind
}

teardown_file() {
	$NIM action:delete test_environ/variable
  $NIM package delete test_environ
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
