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
const javascript = js

const ts = `export function main(args: {}): {} {
    let name: string = args['name'] || 'stranger'
    let greeting: string = 'Hello ' + name + '!'
    console.log(greeting)
    return { body: greeting }
  }
  `
const typescript = ts

const py = `def main(args):
      name = args.get("name", "stranger")
      greeting = "Hello " + name + "!"
      print(greeting)
      return {"body": greeting}
  `
const python = py

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
\tname, ok := args["name"].(string)
\tif !ok {
\t\tname = "stranger"
\t}
\tmsg := make(map[string]interface{})
\tmsg["body"] = "Hello " + name + "!"
\treturn msg
}
`
const golang = go

const rust = `extern crate serde_json;

use serde_derive::{Deserialize, Serialize};
use serde_json::{Error, Value};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Input {
    #[serde(default = "stranger")]
    name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Output {
    body: String,
}

fn stranger() -> String {
    "stranger".to_string()
}

pub fn main(args: Value) -> Result<Value, Error> {
    let input: Input = serde_json::from_value(args)?;
    let output = Output {
        body: format!("Hello {}", input.name),
    };
    serde_json::to_value(output)
}
`

const deno = `export default function main(args: {[key: string]: any}) {
  return {
    body: \`Hello \${args.name || "stranger"}!\`,
  };
};`

const ruby = `def main(args)
name = args["name"] || "stranger"
greeting = "Hello #{name}!"
puts greeting
{ "body" => greeting }
end`

const csharp = `using System;
using Newtonsoft.Json.Linq;

namespace Nimbella.Example.Dotnet
{
    public class Hello
    {
        public JObject Main(JObject args)
        {
            string name = "stranger";
            if (args.ContainsKey("name")) {
                name = args["name"].ToString();
            }
            JObject message = new JObject();
            message.Add("body", new JValue($"Hello {name}!"));
            return (message);
        }
    }
}`
const cs = csharp

export const samples = { deno, cs, csharp, go, golang, java, javascript, js, php, py, python, ruby, rust, swift, ts, typescript }
