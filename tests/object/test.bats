# PURPOSE:
# I will test the following commands: object create, get, list, update, url, delete, and clean.
load ../test_setup.bash

# constants
FILES="$(pwd)/tests/object/test_files/*"

@test "object create" { # object create test
  for f in $FILES
  do
    run $NIM object create "$f"
    assert_success
    assert_output --partial "done"
  done
}

@test "object get" { # object get test
  for f in $FILES
  do
    run $NIM object get "$(basename $f)"
    assert_success
    if assert_output --partial "done" | grep "Sample text" "$f"
    then
      assert true
    else
      assert false
    fi
  done
}

@test "object list" { # object list test
  path="$(pwd)/tests/object/test_files"
  list=$(ls -R $path)

  run $NIM object list
  assert_success
  assert [ "$output" == "$list" ]
}

@test "object url" { # object url test
  for f in $FILES
  do
    run $NIM object url "$(basename $f)"
    assert_success
    echo "$output"
    if curl -s "$output" | grep "Sample text"
    then
      assert true
    else
      assert false
  fi
  done
}

@test "object update" { # object update test
  for f in $FILES
  do
    run $NIM object update "$f"
    assert_success
    assert_output --partial "done"
  done
}

@test "object delete" { # object delete test
  for f in $FILES
  do
    run $NIM object delete "$(basename $f)"
    assert_success
    assert_output --partial "done"
  done
}

@test "object clean" { # object clean test
  run $NIM object clean --force
  assert_success
  assert_output --partial "done"

  run $NIM object list
  assert_success
  assert_output ""
}