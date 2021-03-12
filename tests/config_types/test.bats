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

# This tests enforcement of the rule that certain clauses (environment, parameters, annotations) of project.yml must be dictionaries

load ../test_setup.bash

@test "cannot deploy project with invalid annotations" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-annotations
	assert_failure
	assert_output --partial " Error: annotations must be a dictionary"
}

@test "cannot deploy project with invalid env" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-env
	assert_failure
	assert_output --partial " Error: the environment clause must be a dictionary"
}

@test "cannot deploy project with invalid parameters" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-parameters
	assert_failure
	assert_output --partial " Error: parameters must be a dictionary"
}

@test "cannot deploy project with invalid top-level parameter " {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-cases/invalid-parameters-toplevel
	assert_failure
	assert_output --partial " Error: parameters member must be a dictionary"
}
