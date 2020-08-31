/*
 * Copyright (c) 2019 - present Nimbella Corp.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

//
//  Samples
//  TODO: these should be in common between here, the playground, and the cloud editor.
//  As it stands
//    - the playground has its own table although its samples are (mostly) textually the same as these
//    - the cloud editor has its own table (in placeholders.ts).  It samples are similar to a subset of these
//      (lacking java, go, and typescript)
//

const js = `function main(args) {
    let name = args.name || 'stranger'
    let greeting = 'Hello ' + name + '!'
    console.log(greeting)
    return {"body": greeting}
  }
  `

const ts = `export function main(args: {}): {} {
    let name: string = args['name'] || 'stranger'
    let greeting: string = 'Hello ' + name + '!'
    console.log(greeting)
    return { body: greeting }
  }
  `

const py = `def main(args):
      name = args.get("name", "stranger")
      greeting = "Hello " + name + "!"
      print(greeting)
      return {"body": greeting}
  `

const swift = `func main(args: [String:Any]) -> [String:Any] {
      if let name = args["name"] as? String {
          let greeting = "Hello \\(name)!"
          print(greeting)
          return [ "greeting" : greeting ]
      } else {
          let greeting = "Hello stranger!"
          print(greeting)
          return [ "body" : greeting ]
      }
  }
  `

const php = `<?php
  function main(array $args) : array
  {
      $name = $args["name"] ?? "stranger";
      $greeting = "Hello $name!";
      echo $greeting;
      return ["body" => $greeting];
  }
  `

const java = `import com.google.gson.JsonObject;

  public class Main {
      public static JsonObject main(JsonObject args) {
          String name = "stranger";
          if (args.has("name"))
              name = args.getAsJsonPrimitive("name").getAsString();
          String greeting = "Hello " + name + "!";
          JsonObject response = new JsonObject();
          response.addProperty("body", greeting);
          return response;
      }
  }
  `

const go = `package main

  func Main(args map[string]interface{}) map[string]interface{} {
    name, ok := args["name"].(string)
    if !ok {
      name = "stranger"
    }
    msg := make(map[string]interface{})
    msg["body"] = "Hello, " + name + "!"
    return msg
  }
  `
export const samples = { js, py, php, swift, java, go, ts }
