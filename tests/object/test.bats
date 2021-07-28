# PURPOSE:
# I will test the following commands: object create, get, list, update, url, delete, and clean.
load ../test_setup.bash

# constants
obj1="test1.txt"
obj2="test2.txt"
obj3="test3.txt"

@test "object create" { # object create test
  
  filePath="$(pwd)/tests/object/objectTesting/""${obj1}" # path to test1.txt

  run $NIM object create "$filePath"
  assert_success
  assert_output --partial "done"

	
}

@test "object get" { # object get test

  run $NIM object get $obj1
  assert_success
  assert_output --partial "done"
	
}

@test "object list" { # object list test
  
  filePath="$(pwd)/tests/object/objectTesting/""${obj2}" # path to test2.txt
  run $NIM object create "$filePath" # creating another object to test list functionality

  listString="${obj1}"$'\n'"${obj2}"

  run $NIM object list
  assert_success
  assert_output "${listString}"
	
}

@test "object url" { # object url test
  
  filePath="$(pwd)/tests/object/objectTesting/""${obj3}" # path to test3.txt
  run $NIM object create "$filePath" # creating another object to test url functionality

  run $NIM object url $obj3
  assert_success
  if curl -s "$output" | grep "Hello World!" # curl output should equal text in test3.txt
  then
    assert true
  else
    assert false
  fi
	
}

@test "object update" { # object update test

  run $NIM object update ${obj1}
  assert_success
  assert_output --partial "done"
	
}

@test "object delete" { # object delete test

  run $NIM object delete ${obj2}
  assert_success
  assert_output --partial "done"
	
}

@test "object clean" { # object clean test
  run $NIM object clean --force
  assert_success
  assert_output --partial "done"

  run $NIM object list
  assert_success
  assert_output ""
	
}

