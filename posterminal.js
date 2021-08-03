import { promisify } from 'util'
import { execFile } from 'child_process'
import { readFile } from 'fs/promises'

import { decode } from 'iconv-lite'

import { Parser } from './parser.js'
import logger from './logger.js'

const execute = promisify(execFile)

export class TerminalError extends Error {
  constructor (message, details) {
    super(message)
    this.details = details
  }
}

export class Terminal {
  constructor (sbp, e, p) {
    this.sbp = sbp
    this.e = e
    this.p = p

    this._parser = new Parser('')
    this._lastResult = null
  }

  async _execute (parameters = []) {
    logger.info(`Executing file "${this.sbp}" with parameters "${parameters}"`)

    let result
    try {
      result = await execute(this.sbp, parameters)
    } catch (exception) {
      throw new TerminalError('Unable to execute sb_pilot', exception)
    }

    logger.info(`Received stdout "${result.stdout}", stderr "${result.stderr}"`)

    if (result.stderr) throw new TerminalError('Non-empty stderr of sb_pilot', result.stderr)

    // last non-empty line must contain only "return:<code>"
    const match = result.stdout.trim().split('\n').pop().match(/^return:\s*(-?\d+)\s*$/)
    if (match) return parseInt(match[1])
    throw new TerminalError('Unexpected stdout of sb_pilot', result.stdout)
  }

  static async _read (path, tag) {
    try {
      return decode(await readFile(path), 'koi8-r')
    } catch (exception) {
      throw new TerminalError(`Unable to read "${tag}" file`, exception)
    }
  }

  async _parsePayment () {
    const content = await Terminal._read(this.e, 'e')

    try {
      // empty line to easy deal with optional 'reference link'
      const parser = this._parser.reset(content + '\n\n')
      const [code, message] = parser.parseStatusLine()

      const result = { code, message }
      /* eslint-disable dot-notation */
      result['card number'] = parser.parseStringLine()
      result['expiration date'] = parser.parseStringLine()
      result['authorization code'] = parser.parseStringLine()
      result['inner transaction number'] = parser.parseStringLine()
      result['card type'] = parser.parseStringLine()
      result['card sign'] = parser.parseIntegerLine()
      result['terminal number'] = parser.parseStringLine()
      result['date'] = parser.parseDateLine()
      result['reference link'] = parser.parseStringLine()
      /* eslint-enable dot-notation */

      return JSON.stringify(result)
    } catch (exception) {
      throw new TerminalError('Unable to parse "e" file', exception)
    }
  }

  async _parseStatus () {
    const content = await Terminal._read(this.e, 'e')

    try {
      const parser = this._parser.reset(content + '\n')
      const [code, message] = parser.parseStatusLine()
      return JSON.stringify({ code, message })
    } catch (exception) {
      throw new TerminalError('Unable to parse "e" file', exception)
    }
  }

  async _helper (executeParameters, parseMethod) {
    try {
      const code = await this._execute(executeParameters)
      if (code !== 0) throw new TerminalError('Error of sb_pilot', code)

      const description = await this[parseMethod]()
      const slip = await Terminal._read(this.p, 'p')

      return { status: 'ok', description, slip }
    } catch (exception) {
      logger.error(exception.message)
      throw exception
    }
  }

  async processPayment (amount) {
    logger.info(`Processing payment with amount = ${amount}`)
    return (this._lastResult = this._helper(['1', amount.toString()], '_parsePayment'))
  }

  async checkConnection () {
    logger.info('Checkin connection with bank')
    return (this._lastResult = this._helper(['47', '2'], '_parseStatus'))
  }

  async checkResults () {
    logger.info('Checkin results')
    return (this._lastResult = this._helper(['7'], '_parseStatus'))
  }

  async getLastResult () {
    return this._lastResult
  }
}
