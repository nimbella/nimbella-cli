import { ActionSpec } from '../../src/deploy-struct'
import { calculateActionExec } from '../../src/deploy'

// TODO: 
// Need to calculate the actionExec property:
// { kind = 'blackbox', image: flags.docker }
// { kind = runtime, image: flags.docker }
describe('test calculating action runtime kind property', () => {
  test('should return runtime property as kind', () => {
    const as: ActionSpec = {
      name: 'test-action',
      main: 'main',
      binary: true,
      runtime: 'test-runtime'
    }
    const code = 'this is the action code'
    expect(calculateActionExec(as, code)).toStrictEqual({ code, binary: as.binary, main: as.main, kind: as.runtime })
  })
  test('should return blackbox kind from docker property', () => {
    const as: ActionSpec = {
      name: 'test-docker-action',
      main: 'main',
      binary: true,
      docker: 'docker-image'
    }
    const code = 'this is the action code'
    expect(calculateActionExec(as, code)).toStrictEqual({ code, binary: as.binary, main: as.main, image: as.docker, kind: 'blackbox' })
  })
  test('should ignore explicit runtime with docker property', () => {
    const as: ActionSpec = {
      name: 'test-docker-action',
      main: 'main',
      binary: true,
      docker: 'docker-image',
      runtime: 'another-runtime'
    }
    const code = 'this is the action code'
    expect(calculateActionExec(as, code)).toStrictEqual({ code, binary: as.binary, main: as.main, image: as.docker, kind: 'blackbox' })
  })

})
