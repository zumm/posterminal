## Installation
Install using `yarn`:
```bash
yarn add https://github.com/zumm/posterminal
```
Or `npm`:
```bash
npm install https://github.com/zumm/posterminal
```

## Testing
Tests and testing tools are not part of package, so you need to clone repository first:
```bash
git clone https://github.com/zumm/posterminal
cd posterminal
```
Now you can install testing tools and test this package using `yarn`:
```bash
yarn install
yarn test
```
Or `npm`:
```bash
npm install
npm run test
```

## Using
```js
import { Terminal, TerminalError } from 'posterminal'

const SBP = '/path/to/sbp'
const P = '/path/to/p'
const E = '/path/to/e'

try {
  const terminal = new Terminal(SBP, P, E)

  // all methods return:
  // { status: 'ok', description: '<content of P file represented in JSON>', slip: '<content of E file as is>' }
  await terminal.checkConnection()
  await terminal.processPayment(127) 
  await terminal.checkResults()
  await terminal.getLastResult()
} catch (exception) {
  if (exception instanceof TerminalError) {
    // some error handling
  }
  
  console.log(exception)
}
```