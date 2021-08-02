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

  listString1="ANOTHER_KEY"$'\n'"${KEY_NAME}"
  listString2="${KEY_NAME}"$'\n'"ANOTHER_KEY"

  run $NIM key-value list
  assert_success
  #assert_output "${listString1}"
  
  if [ "$listString1" == "$output" ]; then
    assert true
  elif [ "$listString2" == "$output" ]; then
    assert true
  else
   assert false
  fi
	
}

@test "kv expire/ttl" { # kv expire/ttl test

  run $NIM key-value expire $KEY_NAME "6" # expire time set for 6 seconds
  assert_success
  assert_output "1"

  run $NIM key-value ttl $KEY_NAME # checking remaining time of key
  assert_success
  [ "$status" -le "6" ]

  sleep 6 # pausing script for 6 seconds

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
