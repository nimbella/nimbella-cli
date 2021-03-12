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

# This tests the feature whereby an 'environment' clause of project.yml
# translates to 'parameters' with init=true
# It also tests the ability to place environment and parameters on a package or the project as a whole

load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	$NIM action:delete test_split_params/authorize
  $NIM package delete test_split_params
}

@test "deploy project with split-level parameters in config" {
	run $NIM action get test_split_params/authorize
	assert_success
	assert_output --partial '"parameters": [
    {
      "init": true,
      "key": "e1",
      "value": "eone"
    },
    {
      "key": "p3",
      "value": "pthree"
    },
    {
      "init": true,
      "key": "e3",
      "value": "ethree"
    },
    {
      "key": "p2",
      "value": "ptwo"
    },
    {
      "init": true,
      "key": "e2",
      "value": "etwo"
    },
    {
      "key": "p1",
      "value": "pone"
    }
  ],'
}
