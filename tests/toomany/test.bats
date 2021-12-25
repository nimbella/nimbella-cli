load ../test_setup.bash
APIHOST=$($NIM auth current --apihost)

teardown_file() {
  delete_package "test-toomany"
	rm -fr $BATS_TEST_DIRNAME/packages
}

@test "deploy projects with 500 actions" {
	rm -fr $BATS_TEST_DIRNAME/packages
  mkdir -p $BATS_TEST_DIRNAME/packages/test-toomany
	for i in {1..500}; do touch $BATS_TEST_DIRNAME/packages/test-toomany/h$i.js; done
  run $NIM project deploy $BATS_TEST_DIRNAME  | grep '\- t' | wc -l
  assert_success
}
