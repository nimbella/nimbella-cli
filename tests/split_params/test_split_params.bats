load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test_split_params"
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
