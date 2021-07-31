// there is no reason to use real parsers/lexers/grammars to parse "p" file of sb_pilot
// but i want to formalize this process a bit

export class ParserError extends Error {
  constructor (error, position, source) {
    super(`${error} in position = ${position}\n${source.slice(position, position + 24)}`)

    this.error = error
    this.position = position
    this.source = source
  }
}

export class Parser {
  constructor (source, offset, length) {
    this.reset(source, offset, length)
  }

  _parse (pattern, { min = 0, max = Number.MAX_VALUE, inverted = false } = {}) {
    max = Math.min(max, this._length)

    let length = 0
    for (; length < max && inverted !== pattern.includes(this._source[this._offset + length]); length++) {}

    if (min > length) throw new ParserError('Syntax error', this._offset + length, this._source)

    this._offset += length
    this._length -= length

    return length
  }

  _get (length) {
    return this._source.slice(this._offset - length, this._offset)
  }

  reset (source, offset = 0, length = source.length) {
    this._source = source
    this._offset = offset
    this._length = length

    return this
  }

  skipSymbols () {
    return this._parse(...arguments)
  }

  parseSymbols () {
    return this._get(this.skipSymbols(...arguments))
  }

  skipInteger () {
    return this.skipSymbols(['-'], { max: 1 }) + this.skipSymbols([...'1234567890'], { min: 1 })
  }

  parseInteger () {
    // assume String('-' + digits) will be always valid integer
    return parseInt(this._get(this.skipInteger(...arguments)))
  }

  skipComment (required = true) {
    if (!this.skipSymbols(['|'], { min: required ? 1 : 0, max: 1 })) return 0
    return this.skipSymbols(['\n'], { inverted: true })
  }

  parseComment () {
    return this._get(this.skipComment(...arguments))
  }

  parseStringLine () {
    const result = this.parseSymbols(['|', '\n'], { inverted: true })
    this.skipComment(false)
    this.skipSymbols(['\n'], { min: 1, max: 1 })
    return result.trim()
  }

  parseIntegerLine () {
    const result = this.parseInteger()
    this.skipSymbols([...' \t\r'])
    this.skipComment(false)
    this.skipSymbols(['\n'], { min: 1, max: 1 })
    return result
  }

  parseDateLine () {
    const result = this.parseSymbols([...'1234567890'], { min: 14, max: 14 })
    const date = new Date(result.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6Z'))
    if (!date.toJSON()) throw new ParserError('Invalid date', this._offset - 14, this._source)
    this.skipSymbols([...' \t\r'])
    this.skipComment(false)
    this.skipSymbols(['\n'], { min: 1, max: 1 })
    return date
  }

  parseStatusLine () {
    const code = this.parseInteger()
    this.skipSymbols([...' \t'])
    this.skipSymbols([','], { min: 1, max: 1 })
    const message = this.parseStringLine()

    return [code, message]
  }
}
