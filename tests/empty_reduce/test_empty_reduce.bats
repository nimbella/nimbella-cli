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

# This tests the artificial project 'emptyReduce' which has an empty default package
# There was a bug in this case: 'Error! Reduce of empty array with no initial value'

load ../test_setup.bash

@test "deploying project with nothing to deploy" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	assert_success
	assert_output --partial "Nothing deployed"
}
