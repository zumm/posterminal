/* eslint-env jest */
import mock from 'mock-fs'
import { execFile } from 'child_process'
import { Terminal, TerminalError } from './posterminal.js'

const SBP = '/path/to/fake/sbp'
const P = '/path/to/fake/p'
const E = '/path/to/fake/e'

jest.mock('child_process')

const terminal = new Terminal(SBP, P, E)

const paymentResults = function * () {
  yield terminal.processPayment(23)
  yield terminal.getLastResult()
}

const otherResults = function * () {
  yield terminal.checkConnection()
  yield terminal.getLastResult()
  yield terminal.checkResults()
  yield terminal.getLastResult()
}

const results = function * () {
  yield * paymentResults()
  yield * otherResults()
}

const execFileSuccess = (command, parameters, callback) => callback(null, { stdout: 'return:0' })

describe('troubles with sb_pilot file', () => {
  const trouble = new Error()

  beforeAll(() => {
    execFile.mockImplementation((command, parameters, callback) => callback(trouble))
    mock({}, {})
  })

  afterAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock.restore()
  })

  test('all methods throw exception', async () => {
    for (const result of results()) {
      await expect(result).rejects.toThrow(TerminalError)
      await expect(result).rejects.toHaveProperty('message', 'Unable to execute sb_pilot')
      await expect(result).rejects.toHaveProperty('details', trouble)
    }
  })
})

describe('invalid sb_pilot output', () => {
  const badOutput = 'bad output'

  beforeAll(() => {
    execFile.mockImplementation((command, parameters, callback) => callback(null, { stdout: badOutput }))
    mock({}, {})
  })

  afterAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock.restore()
  })

  test('all methods throw exception', async () => {
    for (const result of results()) {
      await expect(result).rejects.toThrow(TerminalError)
      await expect(result).rejects.toHaveProperty('message', 'Unexpected output of sb_pilot')
      await expect(result).rejects.toHaveProperty('details', badOutput)
    }
  })
})

describe('code of sb_pilot is not zero', () => {
  const badCode = 23

  beforeAll(() => {
    execFile.mockImplementation((command, parameters, callback) => callback(null, { stdout: 'return:' + badCode }))
    mock({}, {})
  })

  afterAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock.restore()
  })

  test('all methods throw exception', async () => {
    for (const result of results()) {
      await expect(result).rejects.toThrow(TerminalError)
      await expect(result).rejects.toHaveProperty('message', 'Error of sb_pilot')
      await expect(result).rejects.toHaveProperty('details', badCode)
    }
  })
})

describe('troubles with p file', () => {
  beforeAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock({}, {})
  })

  afterAll(() => {
    mock.restore()
  })

  test('all methods throw exception', async () => {
    for (const result of results()) {
      await expect(result).rejects.toThrow(TerminalError)
      await expect(result).rejects.toHaveProperty('message', 'Unable to read "p" file')
      await expect(result).rejects.toHaveProperty('details', expect.any(Error))
    }
  })
})

describe('invalid p file content', () => {
  beforeAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock({ [P]: 'bad content' }, {})
  })

  afterAll(() => {
    mock.restore()
  })

  test('all methods throw exception', async () => {
    for (const result of results()) {
      await expect(result).rejects.toThrow(TerminalError)
      await expect(result).rejects.toHaveProperty('message', 'Unable to parse "p" file')
      await expect(result).rejects.toHaveProperty('details', expect.any(Error))
    }
  })
})

describe('troubles with e file', () => {
  beforeAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock({ [P]: mock.load('p.txt') }, {})
  })

  afterAll(() => {
    mock.restore()
  })

  test('all methods throw exception', async () => {
    for (const result of results()) {
      await expect(result).rejects.toThrow(TerminalError)
      await expect(result).rejects.toHaveProperty('message', 'Unable to read "e" file')
      await expect(result).rejects.toHaveProperty('details', expect.any(Error))
    }
  })
})

describe('everything ok', () => {
  beforeAll(() => {
    execFile.mockImplementation(execFileSuccess)
    mock({ [P]: mock.load('p.txt'), [E]: 'good content' }, {})
  })

  afterAll(() => {
    mock.restore()
  })

  /* eslint-disable quote-props */
  const jsonPayment = JSON.stringify({
    'code': 0,
    'message': 'Успешно',
    'card number': '4276********2106',
    'expiration date': '10/09',
    'authorization code': '013AU3',
    'inner transaction number': '0007',
    'card type': 'VISA',
    'card sign': 1,
    'terminal number': '00870001',
    'date': '2012-04-03T17:34:15.000Z',
    'reference link': '481CF86160609155A2310BD83D7512BA34F48328'
  })
  /* eslint-enable quote-props */

  test('payment method returns valid data', async () => {
    for (const result of paymentResults()) {
      await expect(result).resolves.toHaveProperty('status', 'ok')
      await expect(result).resolves.toHaveProperty('description', jsonPayment)
      await expect(result).resolves.toHaveProperty('slip', 'good content')
    }
  })

  const jsonStatus = JSON.stringify({ code: 0, message: 'Успешно' })

  test('other methods return valid data', async () => {
    for (const result of otherResults()) {
      await expect(result).resolves.toHaveProperty('status', 'ok')
      await expect(result).resolves.toHaveProperty('description', jsonStatus)
      await expect(result).resolves.toHaveProperty('slip', 'good content')
    }
  })
})
