import { validateDeployConfig } from "../../src/util";

describe('test validation of deploy configuration', () => {
  test('should validate empty config', () => {
    const config = {}
    expect(validateDeployConfig(config)).toBe(undefined)
  })

  test('should validate config with docker action', () => {
    const action = { name: 'hello-docker', main: 'main', docker: 'python:default' }
    const packages = [{ name: 'default', actions: [action] }]
    const config = { packages }
    expect(validateDeployConfig(config)).toBe(undefined)
  })
  test('should return error for config with invalid docker property', () => {
    const invalidProps = [{}, [], 1, true]

    const action = { name: 'hello-docker', main: 'main', docker: null }
    const packages = [{ name: 'default', actions: [action] }]
    const config = { packages }

    invalidProps.forEach(p => {
      action.docker = p
      expect(validateDeployConfig(config)).toBe("'docker' member of an 'action' must be a string")
    })
  })
})
