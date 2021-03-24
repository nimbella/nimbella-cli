load ../test_setup.bash

setup_file() {
	export ZIPFILE=$BATS_TEST_DIRNAME/packages/default/action/__deployer__.zip
}

@test "deploying project with empty zip file should fail" {
	assert_file_not_exist $ZIPFILE
	run $NIM project deploy $BATS_TEST_DIRNAME -v
	assert_failure
	assert_file_not_exist $ZIPFILE
	assert_output --partial "Action 'action' has no included files"
}
