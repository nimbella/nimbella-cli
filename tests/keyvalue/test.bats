# PURPOSE:
# I will test the following commands: kv get/set, clean, del, expire/ttl, and list in the first set of tests.
# I will later add tests for getMany, llen, lrange, rpush, and setMany.
load ../test_setup.bash

# constants?
KEY_NAME="SOMEKEY" # random name?

setup_file() { # kv delete being tested here
  $NIM key-value delete $KEY_NAME
}

teardown_file() { # kv delete also being tested here
  $NIM key-value delete $KEY_NAME
}

@test "kv set/get" { # kv set/get test
  testValue=$(date)

  run $NIM key-value set $KEY_NAME "$testValue"
  assert_success
  assert_output 'OK'

  run $NIM key-value get $KEY_NAME
  assert_success
  assert_output "$testValue"
	
}

@test "kv list" { # kv list test

  run $NIM key-value set ANOTHER_KEY "ANOTHER_VALUE" # adding another item to populate list

  listString="ANOTHER_KEY"$'\n'"${KEY_NAME}"

  run $NIM key-value list
  assert_success
  assert_output "${listString}"
	
}

@test "kv expire/ttl" { # kv expire/ttl test

  run $NIM key-value expire $KEY_NAME "3" # expire time set for 3 seconds
  assert_success
  assert_output "1"

  run $NIM key-value ttl $KEY_NAME # checking remaining time of key
  assert_success
  [ "$status" -le "3" ]

  sleep 3 # pausing script for 3 seconds

  run $NIM key-value get $KEY_NAME # checking to see if key still exists
  assert_success
  assert_output "null"
	
}

@test "kv clean" { # kv clean test

  run $NIM key-value clean --force
  assert_success
  assert_output "all content cleared"

  run $NIM key-value list
  assert_success
  assert_output ""
	
}
