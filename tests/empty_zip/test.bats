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

load ../test_setup.bash

setup_file() {
	ZIPFILE=empty_zip/packages/default/action/__deployer__.zip
}

@test "deploying project with empty zip file should fail" {
	assert_file_not_exist $ZIPFILE
	run $NIM project deploy $BATS_TEST_DIRNAME -v
	assert_failure
	assert_file_not_exist $ZIPFILE
	assert_output --partial "Action 'action' has no included files"
}
