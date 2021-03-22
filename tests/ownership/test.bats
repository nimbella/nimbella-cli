load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME/ownership
	$NIM project deploy $BATS_TEST_DIRNAME/ownership --production
}

@test "deploy project with production namespace conflict" {
	run $NIM project deploy $BATS_TEST_DIRNAME/violator --target wbtestni-grinjpsjnuh
	assert_failure
	assert_output --partial "Deployment to namespace 'wbtestni-grinjpsjnuh' must be from project"
	assert_output --partial "ownership/ownership"
}

@test "deploy project with test namespace conflict" {
	run $NIM project deploy $BATS_TEST_DIRNAME/violator --target dtestnim-i9jmlbfikan
	assert_failure
	assert_output --partial "Deployment to namespace 'dtestnim-i9jmlbfikan' must be from project"
	assert_output --partial "ownership/ownership"
}

@test "deploy project after freeing namespace" {
	run $NIM ns free wb- dt-
	run $NIM project deploy $BATS_TEST_DIRNAME/violator --target dtestnim-i9jmlbfikan
	assert_success	
	run $NIM project deploy $BATS_TEST_DIRNAME/violator --target wbtestni-grinjpsjnuh
	assert_success	
}
